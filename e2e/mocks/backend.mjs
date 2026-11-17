/**
 * Backend simulado para los tests e2e (E2E_BACKEND=mock, el default y el de CI).
 *
 * Imita, en memoria, solo los endpoints de G6D2/emergencias-backend que usan
 * los flujos de ciudadano y dispatcher, con las mismas formas de respuesta
 * (capturadas del backend real). Cada arranque empieza vacío, salvo el
 * catálogo de oficiales, que es el mismo seed de la migración V11.
 *
 * Diferencias con el backend real, a propósito:
 * - Los JWT no van firmados (alg "none"). El BFF no verifica la firma (el
 *   middleware solo lee `exp` y `groups`) y este servidor solo existe en tests.
 * - POST /__e2e/antipanic habilita el botón de pánico de una cuenta. En el
 *   backend real no hay API para eso y el test lo hace por SQL.
 *
 * Uso: node e2e/mocks/backend.mjs (puerto E2E_BACKEND_PORT, 4310 por defecto).
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { BACKEND_PORT } from "../support/env.mjs";

const TOKEN_TTL_SECONDS = 900;
const ALLOWED_DEV_GROUPS = new Set(["citizen", "dispatcher", "officer"]);

// Mismo mapeo que el backend: tipo del front → tipo canónico y severidad.
const EMERGENCY_TYPES = {
  panic: { type: "PANICO", severity: "critical" },
  medical: { type: "MEDICA", severity: "high" },
  fire: { type: "INCENDIO", severity: "high" },
  infrastructure: { type: "INFRAESTRUCTURA", severity: "medium" },
  disturbance: { type: "DISTURBIO_EVENTO_MASIVO", severity: "medium" },
  other: { type: "OTRO", severity: "medium" },
};
const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

// Máquina de estados de src/domain/emergency-status.js del backend.
const TRANSITIONS = {
  PENDING: ["VALIDATED", "CANCELLED", "DISCARDED"],
  VALIDATED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["EN_ROUTE", "VALIDATED"],
  EN_ROUTE: ["ON_SCENE"],
  ON_SCENE: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
  DISCARDED: [],
};
const TERMINAL = new Set(["CLOSED", "CANCELLED", "DISCARDED"]);

const users = new Map(); // email → cuenta local (POST /auth/register)
const emergencies = new Map(); // id → emergencia
const statusHistory = new Map(); // id → historial de estados
let historySeq = 0;

// Seed de la migración V11__create_officers.sql.
const officers = [
  ["of-001", "Oficial Carlos Gómez", "CP-4021", "Av. 9 de Julio y Corrientes", "350 m", "disponible"],
  ["of-002", "Oficial Mariana López", "CP-3108", "Plaza de Mayo", "800 m", "disponible"],
  ["of-003", "Oficial Martín Rodríguez", "CP-5520", "Av. Santa Fe y Callao", "1.2 km", "disponible"],
  ["of-004", "Oficial Lucía Fernández", "CP-2214", "Palermo Soho", "1.5 km", "disponible"],
  ["of-005", "Oficial Diego Álvarez", "CP-7783", "Recoleta", "2.1 km", "disponible"],
  ["of-006", "Oficial Sofía Ruiz", "CP-1190", "San Telmo", "900 m", "disponible"],
  ["of-007", "Oficial Pablo Méndez", "CP-6402", "Belgrano", "2.8 km", "ocupado"],
  ["of-008", "Oficial Valentina Castro", "CP-3356", "Caballito", "3.4 km", "disponible"],
  ["of-009", "Oficial Andrés Quiroga", "CP-8811", "Almagro", "1.8 km", "disponible"],
  ["of-010", "Oficial Camila Torres", "CP-5044", "Microcentro", "600 m", "ocupado"],
].map(([id, name, badgeNumber, location, distance, status]) => {
  const now = new Date().toISOString();
  return { id, name, badgeNumber, location, distance, status, createdAt: now, updatedAt: now };
});

class HttpError extends Error {
  constructor(status, error, message) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

const badRequest = (message) => new HttpError(400, "Bad Request", message);
const notFound = (message = "Emergency not found") => new HttpError(404, "Not Found", message);
const conflict = (message) => new HttpError(409, "Conflict", message);

// ── Tokens ────────────────────────────────────────────────────────────
function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function issueToken({ sub, preferred_username, groups, has_antipanic_button }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: ["citypass-emergencias-api"],
    iss: "urn:citypass:e2e-mock-backend",
    module: "emergencias",
    sub,
    preferred_username,
    groups,
    ...(typeof has_antipanic_button === "boolean" ? { has_antipanic_button } : {}),
    jti: randomUUID(),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  return {
    access_token: `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.e2e`,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_SECONDS,
  };
}

function authenticate(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8"));
  } catch {
    payload = null;
  }
  if (!payload?.sub || !(payload.exp > Date.now() / 1000)) {
    throw new HttpError(401, "Unauthorized", "Invalid or expired token");
  }
  return {
    sub: payload.sub,
    username: payload.preferred_username,
    groups: Array.isArray(payload.groups) ? payload.groups : [],
    module: payload.module,
    hasAntipanicButton:
      typeof payload.has_antipanic_button === "boolean" ? payload.has_antipanic_button : undefined,
  };
}

function requireGroup(user, ...groups) {
  if (!groups.some((g) => user.groups.includes(g))) {
    throw new HttpError(403, "Forbidden", "Insufficient group membership");
  }
}

// ── Emergencias ───────────────────────────────────────────────────────
function recordTransition(emergency, newStatus, actor, reason = null) {
  const allowed = TRANSITIONS[emergency.status] || [];
  if (TERMINAL.has(emergency.status)) {
    throw conflict(`Emergency in terminal status ${emergency.status} cannot transition to ${newStatus}`);
  }
  if (!allowed.includes(newStatus)) {
    throw conflict(`Invalid transition ${emergency.status} → ${newStatus}`);
  }
  const now = new Date().toISOString();
  historySeq += 1;
  statusHistory.get(emergency.id).push({
    id: String(historySeq),
    emergencyId: emergency.id,
    previousStatus: emergency.status,
    newStatus,
    actor,
    reason,
    createdAt: now,
  });
  emergency.status = newStatus;
  emergency.updatedAt = now;
  if (TERMINAL.has(newStatus)) emergency.closedAt = now;
  return emergency;
}

function findEmergencyFor(user, id) {
  const emergency = emergencies.get(id);
  const isDispatcher = user.groups.includes("dispatcher");
  if (!emergency || (!isDispatcher && emergency.userId !== user.sub)) throw notFound();
  return emergency;
}

function withDispatchFields(emergency) {
  return {
    ...emergency,
    incident: null,
    effectivePriority: emergency.severity,
    dispatchPriority: emergency.severity,
    priorityContext: null,
  };
}

function optionalReason(body) {
  if (body.reason === undefined || body.reason === null) return null;
  if (typeof body.reason !== "string") throw badRequest("reason must be a string");
  return body.reason.trim().slice(0, 500) || null;
}

function createEmergency(user, body) {
  const latitude = body?.location?.latitude;
  const longitude = body?.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw badRequest("location.latitude and location.longitude must be numbers");
  }
  const kind = EMERGENCY_TYPES[String(body.emergencyType || "panic").toLowerCase()] || EMERGENCY_TYPES.other;
  const id = randomUUID();
  const now = new Date().toISOString();
  const emergency = {
    id,
    correlationId: id,
    userId: user.sub,
    latitude,
    longitude,
    address: typeof body.address === "string" && body.address.trim() ? body.address.trim().slice(0, 200) : null,
    locationAnonymized: false,
    locationUnavailable: false,
    description: typeof body.description === "string" ? body.description : null,
    severity: kind.severity,
    status: "PENDING",
    assignedOfficerId: null,
    assignedOfficer: null,
    incidentId: null,
    emergencyType: kind.type,
    source: "INTERNAL",
    requiresManualValidation: false,
    causaTipo: null,
    causaId: null,
    causasRelacionadas: [],
    descripcionProblema: null,
    barrio: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };
  emergencies.set(id, emergency);
  statusHistory.set(id, []);
  return emergency;
}

function listEmergencies(user, query) {
  const isDispatcher = user.groups.includes("dispatcher");
  const statuses = (query.get("status") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 20));
  const desc = query.get("order") !== "asc";
  const byPriority = query.get("sortBy") === "priority";

  const rows = [...emergencies.values()]
    .filter((e) => isDispatcher || e.userId === user.sub)
    .filter((e) => statuses.length === 0 || statuses.includes(e.status))
    .sort((a, b) => {
      if (byPriority) {
        const diff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        // A igual prioridad, la más vieja primero (como findPage del backend).
        if (diff !== 0) return desc ? diff : -diff;
        return a.createdAt.localeCompare(b.createdAt);
      }
      return desc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt);
    });

  const total = rows.length;
  const data = rows
    .slice((page - 1) * limit, page * limit)
    .map((e) => (isDispatcher ? withDispatchFields(e) : e));
  return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

function transitionEmergency(user, id, action, body) {
  if (action === "cancel") {
    requireGroup(user, "citizen");
    const emergency = findEmergencyFor(user, id);
    return recordTransition(emergency, "CANCELLED", user.sub, optionalReason(body));
  }

  requireGroup(user, "dispatcher");
  const emergency = findEmergencyFor(user, id);
  switch (action) {
    case "validate":
      return recordTransition(emergency, "VALIDATED", user.sub);
    case "discard": {
      const reason = optionalReason(body);
      if (!reason) throw badRequest("A discard reason is required");
      return recordTransition(emergency, "DISCARDED", user.sub, reason);
    }
    case "assign": {
      const officerId = typeof body.officerId === "string" ? body.officerId.trim() : "";
      if (!officerId) throw badRequest("officerId is required");
      const officer = officers.find((o) => o.id === officerId);
      if (!officer) throw notFound("Officer not found");
      if (officer.status !== "disponible") throw conflict("Officer is not available");
      recordTransition(emergency, "DISPATCHED", user.sub, `Assigned officer ${officerId}`);
      officer.status = "ocupado";
      emergency.assignedOfficerId = officer.id;
      emergency.assignedOfficer = officer.name;
      return emergency;
    }
    case "return": {
      recordTransition(emergency, "VALIDATED", user.sub, optionalReason(body));
      const officer = officers.find((o) => o.id === emergency.assignedOfficerId);
      if (officer) officer.status = "disponible";
      emergency.assignedOfficerId = null;
      emergency.assignedOfficer = null;
      return emergency;
    }
    default:
      throw new HttpError(404, "Not Found", "Route not found");
  }
}

// ── Cuentas locales ───────────────────────────────────────────────────
function accountResponse(account) {
  return {
    ...issueToken({
      sub: account.id,
      preferred_username: account.displayName,
      groups: account.groups,
      has_antipanic_button: account.hasAntipanicButton,
    }),
    user: {
      sub: account.id,
      username: account.displayName,
      groups: account.groups,
      hasAntipanicButton: account.hasAntipanicButton,
    },
  };
}

function register(body) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("email must be a valid email address");
  if (typeof body.password !== "string" || body.password.length < 8) {
    throw badRequest("password must be at least 8 characters");
  }
  if (users.has(email)) throw conflict("El correo ya está en uso.");
  const account = {
    id: randomUUID(),
    email,
    password: body.password,
    displayName: body.preferred_username || email.split("@")[0],
    groups: ["citizen"],
    hasAntipanicButton: false,
  };
  users.set(email, account);
  return accountResponse(account);
}

function login(body) {
  const account = users.get(String(body.email || "").trim().toLowerCase());
  if (!account || account.password !== body.password) {
    throw new HttpError(401, "Unauthorized", "Correo o contraseña incorrectos.");
  }
  return accountResponse(account);
}

function devLogin(body) {
  const sub = typeof body.sub === "string" ? body.sub.trim() : "";
  if (!sub) throw badRequest("sub is required");
  const groups = (Array.isArray(body.groups) ? body.groups : []).filter((g) => ALLOWED_DEV_GROUPS.has(g));
  const flag = body.has_antipanic_button ?? body.hasAntipanicButton;
  return issueToken({
    sub,
    preferred_username: typeof body.preferred_username === "string" ? body.preferred_username : undefined,
    groups: groups.length > 0 ? groups : ["citizen"],
    has_antipanic_button: typeof flag === "boolean" ? flag : undefined,
  });
}

// ── HTTP ──────────────────────────────────────────────────────────────
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw badRequest("Invalid JSON body");
  }
}

async function route(req, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === "GET" && (pathname === "/health" || pathname === "/")) {
    return [200, { status: "ok", mock: true, timestamp: new Date().toISOString() }];
  }
  if (method === "POST" && pathname === "/auth/dev/login") return [200, devLogin(await readBody(req))];
  if (method === "POST" && pathname === "/auth/register") return [201, register(await readBody(req))];
  if (method === "POST" && pathname === "/auth/login") return [200, login(await readBody(req))];
  if (method === "POST" && pathname === "/__e2e/antipanic") {
    const { email } = await readBody(req);
    const account = users.get(String(email || "").trim().toLowerCase());
    if (!account) throw notFound("Account not found");
    account.hasAntipanicButton = true;
    return [200, { success: true }];
  }

  const user = authenticate(req);

  if (method === "GET" && pathname === "/api/user") {
    return [200, { success: true, data: user }];
  }
  if (method === "POST" && pathname === "/api/panic-button") {
    requireGroup(user, "citizen");
    const emergency = createEmergency(user, await readBody(req));
    return [201, { success: true, emergencyId: emergency.id, message: "Botón de pánico activado", data: emergency }];
  }
  if (method === "GET" && pathname === "/api/emergencies") {
    requireGroup(user, "citizen", "dispatcher");
    return [200, listEmergencies(user, url.searchParams)];
  }
  const detail = pathname.match(/^\/api\/emergencies\/([^/]+)$/);
  if (method === "GET" && detail) {
    requireGroup(user, "citizen", "dispatcher");
    const emergency = findEmergencyFor(user, detail[1]);
    const data = user.groups.includes("dispatcher") ? withDispatchFields(emergency) : emergency;
    return [200, {
      success: true,
      data: { ...data, statusHistory: statusHistory.get(emergency.id), observations: [], reinforcementRequests: [] },
    }];
  }
  const action = pathname.match(/^\/api\/emergencies\/([^/]+)\/([a-z-]+)$/);
  if (method === "PATCH" && action) {
    return [200, { success: true, data: transitionEmergency(user, action[1], action[2], await readBody(req)) }];
  }
  if (method === "GET" && pathname === "/api/officers") {
    requireGroup(user, "dispatcher");
    const status = url.searchParams.get("status");
    return [200, { data: officers.filter((o) => !status || o.status === status) }];
  }
  if (method === "GET" && pathname === "/api/contextos-zona/activos") {
    requireGroup(user, "dispatcher");
    return [200, { data: [] }];
  }
  throw new HttpError(404, "Not Found", "Route not found");
}

const server = http.createServer(async (req, res) => {
  let status;
  let body;
  try {
    [status, body] = await route(req, new URL(req.url, "http://localhost"));
  } catch (error) {
    status = error instanceof HttpError ? error.status : 500;
    body = { error: error.error || "Internal Server Error", message: error.message };
    if (!(error instanceof HttpError)) console.error(error);
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
});

server.listen(BACKEND_PORT, () => {
  console.log(`[e2e] backend simulado en http://localhost:${BACKEND_PORT}`);
});
