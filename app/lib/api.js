import { clearStoredUser, getStoredUser, setStoredUser } from "./auth";
import { SEVERITY_CONFIG } from "./emergencies";

/** Intervalo de polling para el dispatcher (30 s, 2 por minuto). Se pausa con
 *  la pestaña oculta y nunca superpone pedidos (ver createPoller en ./polling).
 *  Se bajó de 15 s para reducir el tráfico del BFF al backend. */
export const POLLING_INTERVAL_MS = 30_000;
/** Intervalo de polling para las vistas del ciudadano y del oficial (30 s,
 *  2 por minuto). Se bajó de 5 s para reducir el tráfico del BFF al backend. */
export const CITIZEN_POLLING_INTERVAL_MS = 30_000;

function purgeLegacyCitizenLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("citypass_personal_data");
    localStorage.removeItem("citypass_saved_locations");
  } catch {
    // ignore
  }
}

function clearClientSensitiveState() {
  clearStoredUser();
  purgeLegacyCitizenLocalStorage();
}

function redirectToLogin() {
  clearClientSensitiveState();
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/acceso")) return;
  window.location.replace("/acceso");
}

// ── Endpoints vía BFF (/api/backend/*) con cookie httpOnly ───────────
// Contrato seguridad backend (2026-08):
// - lat/lng cifrados en reposo; respuesta puede traer locationAnonymized:true y coords null
// - body JSON máx 32kb; location.latitude/longitude deben ser number
// - CORS_ORIGIN en prod; el front usa BFF same-origin (no llama al API directo)
//
// TODO(back): PATCH prioridad (HU-04)
// TODO(back): estados oficial / observaciones / refuerzos (HU-08/09/10) — plataforma oficiales
// TODO(back): live updates SSE/Kafka (HU-07/11)
// TODO(back): Auth IdP real (HU-12)
// TODO(back): Consumir eventos externos (HU-13)

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Store "esperando al backend" ──────────────────────────────────────
// El backend en Render (plan free) tarda 10 a 60 s en despertar y
// lib/backend-fetch.js (usado por el proxy /api/backend/*) reintenta hasta
// ~24 s antes de devolver un error. Mientras tanto, apiFetch queda colgado
// desde la vista del cliente. Este store marca "esperando" cuando una
// llamada supera WAITING_THRESHOLD_MS sin resolverse, para que
// BackendWaitingIndicator (civic/BackendWaitingIndicator.js) muestre un
// aviso discreto fuera del login. Expuesto como un mini event emitter
// compatible con useSyncExternalStore (subscribe + getSnapshot).
const WAITING_THRESHOLD_MS = 3000;
let pendingCalls = 0;
let waiting = false;
let waitTimer = null;
const waitingListeners = new Set();

function setWaiting(value) {
  if (waiting === value) return;
  waiting = value;
  waitingListeners.forEach((listener) => listener());
}

function beginBackendCall() {
  pendingCalls += 1;
  if (!waitTimer && !waiting) {
    waitTimer = setTimeout(() => {
      waitTimer = null;
      if (pendingCalls > 0) setWaiting(true);
    }, WAITING_THRESHOLD_MS);
  }
}

function endBackendCall() {
  pendingCalls = Math.max(0, pendingCalls - 1);
  if (pendingCalls === 0) {
    if (waitTimer) {
      clearTimeout(waitTimer);
      waitTimer = null;
    }
    setWaiting(false);
  }
}

export const backendWaitingStore = {
  subscribe(listener) {
    waitingListeners.add(listener);
    return () => waitingListeners.delete(listener);
  },
  getSnapshot() {
    return waiting;
  },
  getServerSnapshot() {
    return false;
  },
};

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function apiFetch(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // El backend monta todo bajo /api/* (p.ej. /api/panic-button). El BFF
  // reenvía el path tal cual después de /api/backend → BACKEND_URL/<path>.
  // No strippear "/api": si no, termina en BACKEND_URL/panic-button (404).
  const url = auth ? `/api/backend${path}` : path;

  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const send = () =>
    fetch(url, { method, headers, credentials: "same-origin", body: payload });

  let res;
  beginBackendCall();
  try {
    res = await send();
  } finally {
    endBackendCall();
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    if (res.status === 401 && auth) {
      try {
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        if (refreshRes.ok) {
          const retryRes = await send();
          if (retryRes.ok) {
            return await parseJsonSafe(retryRes);
          }
        }
      } catch {
        // Continuar con redirectToLogin
      }
      redirectToLogin();
    }
    const message =
      data?.message || data?.error || `Error HTTP ${res.status}`;
    throw new ApiError(message, { status: res.status, body: data });
  }

  return data;
}

/** Login vía Route Handler: setea cookie httpOnly (no guarda JWT en el browser). */
// TODO(back): reemplazar por login federado IdP cuando AUTH_MODE=idp (HU-12)
export async function loginDev({
  sub,
  preferred_username,
  groups = ["citizen"],
  hasAntipanicButton = false,
  loginMethod = "anonima",
}) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sub, preferred_username, groups, hasAntipanicButton }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  // Attach loginMethod to local profile (not sent to backend – mock only)
  const user = { ...data.user, loginMethod };
  setStoredUser(user);
  return { user };
}

/** Login real email+password (POST /auth/login en el backend). */
export async function loginWithPassword({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  const user = { ...data.user, loginMethod: "sesion" };
  setStoredUser(user);
  return { user };
}

/** Login institucional vía LDAP (POST /api/auth/login con loginType="ldap"). */
export async function loginWithLdap({ username, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      username: username?.trim(),
      email: username?.trim(),
      password,
      loginType: "ldap",
    }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  const user = { ...data.user, loginMethod: "ldap" };
  setStoredUser(user);
  return { user };
}

/** Registro real email+password (POST /auth/register). */
export async function registerAccount({ email, password, preferred_username }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ email, password, preferred_username }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  const user = { ...data.user, loginMethod: "sesion" };
  setStoredUser(user);
  return { user };
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  clearClientSensitiveState();
}

export {
  fetchCitizenProfile,
  saveCitizenProfile,
  fetchSavedLocations,
  createSavedLocation,
  patchSavedLocation,
  deleteSavedLocation,
} from "./citizen-profile-api.js";

export async function fetchCurrentUser() {
  const res = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    if (res.status === 401) {
      redirectToLogin();
    } else {
      clearStoredUser();
    }
    throw new ApiError(data?.message || "Sin sesión", {
      status: res.status,
      body: data,
    });
  }
  // Preserve mock-only fields (e.g. loginMethod) that the session API doesn't return
  const existing = getStoredUser();
  const merged = { ...(existing || {}), ...data.data };
  setStoredUser(merged);
  return merged;
}

// Tope del backend para el campo opcional `address` (string ≤ 200, ver
// POST /api/panic-button en emergencies-backend).
const ADDRESS_MAX_LENGTH = 200;

export async function triggerPanicButton({
  latitude,
  longitude,
  description,
  severity = "critical",
  emergencyType = "panic",
  address,
}) {
  // Backend exige numbers (AES location crypto + ValidationError si NaN/string)
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError("Ubicación inválida: latitude/longitude deben ser números", {
      status: 400,
    });
  }

  const body = {
    location: { latitude: lat, longitude: lng },
    severity,
    emergencyType,
  };
  if (description) body.description = description;
  if (typeof address === "string" && address.trim()) {
    body.address = address.trim().slice(0, ADDRESS_MAX_LENGTH);
  }

  return apiFetch("/api/panic-button", {
    method: "POST",
    body,
  });
}

export async function fetchEmergencyDetail(id) {
  const res = await apiFetch(`/api/emergencies/${id}`);
  return res.data;
}

export async function fetchEmergencies() {
  const { data } = await fetchEmergenciesPage({ limit: 100 });
  return data;
}

/**
 * Estados que muestran las vistas operativas del dispatcher (lista, mapa y
 * tablero por estados): todo lo que sigue abierto. Las cerradas, canceladas
 * y descartadas viven en /ops/historial. Sin CREATED: son filas legacy de
 * antes de la máquina de estados y el backend no las deja transicionar.
 */
export const OPS_STATUSES = [
  "PENDING",
  "VALIDATED",
  "DISPATCHED",
  "EN_ROUTE",
  "ON_SCENE",
  "RESOLVED",
];

export function isOpsStatus(status) {
  return OPS_STATUSES.includes(status);
}

/**
 * Emergencias abiertas para el dispatcher, las más urgentes primero.
 *
 * Antes las vistas usaban fetchEmergencies() (las 100 más nuevas, sin filtro
 * de estado): con más de 100 emergencias, una PENDING crítica vieja quedaba
 * afuera. Ahora se filtra por estado en el backend y se ordena por prioridad
 * efectiva (sortBy=priority + order=desc: críticas primero y, a igual
 * prioridad, la más vieja primero; ver findPage en el repository de
 * emergencias-backend). El tope de 100 por página es del backend.
 */
export async function fetchOpsEmergencies() {
  const { data } = await fetchEmergenciesPage({
    status: OPS_STATUSES.join(","),
    limit: 100,
    sortBy: "priority",
    order: "desc",
  });
  return data;
}

/**
 * Página de emergencias vía GET /api/emergencies, con filtros/paginación.
 *
 * `status` acepta un string con uno o varios estados separados por coma
 * (el controller del backend hace `status.split(',')` y filtra con
 * `status = ANY(...)`, ver src/controllers/emergency.controller.js) — así que
 * /ops/historial pide todos los estados terminales (CLOSED, CANCELLED,
 * DISCARDED, RESOLVED) en una sola llamada en vez de una por estado.
 *
 * Devuelve `{ data, pagination }` con `pagination: { page, limit, total,
 * totalPages } | null` (null si el backend todavía no la manda) para que
 * quien la use pueda pedir la página siguiente ("Cargar más").
 */
export async function fetchEmergenciesPage({
  status,
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  order = "desc",
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sortBy", sortBy);
  params.set("order", order);

  const res = await apiFetch(`/api/emergencies?${params.toString()}`);
  const data = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res)
      ? res
      : [];
  const pagination = res?.pagination || null;
  return { data, pagination };
}

export async function cancelEmergency(id, reason = null) {
  const res = await apiFetch(`/api/emergencies/${id}/cancel`, {
    method: "PATCH",
    body: reason ? { reason } : {},
  });
  return res.data;
}

// ── Kanban legacy (DispatcherView Mantine) ───────────────────────────
// SEVERITY_CONFIG vive en ./emergencies (fuente única compartida con
// PRIORITY_CONFIG de la lista); se re-exporta acá por compatibilidad.
export { SEVERITY_CONFIG };

// Columnas del tablero: una por cada estado de OPS_STATUSES. Las cerradas no
// tienen columna porque fetchOpsEmergencies() ya no las trae (están en
// /ops/historial).
export const STATUS_CONFIG = [
  { key: "pendiente", label: "Pendientes", color: "red" },
  { key: "validada", label: "Validadas", color: "orange" },
  { key: "despachada", label: "Despachadas", color: "yellow" },
  { key: "en_camino", label: "En Camino", color: "cyan" },
  { key: "en_lugar", label: "En Lugar", color: "indigo" },
  { key: "resuelta", label: "Resuelta", color: "teal" },
];

export async function reportIncident({
  category,
  latitude,
  longitude,
  severity,
  description,
  address,
}) {
  const type = String(category || "other").toLowerCase();
  // SOS = critical; incidentes: medical/fire = high, resto = medium
  const defaultSeverity =
    type === "medical" || type === "fire" ? "high" : "medium";
  // Reusa POST /api/panic-button con emergencyType del incidente.
  // El backend suele devolver message="Botón de pánico activado"; lo
  // reemplazamos para no mostrarlo en el flujo de reportar.
  const result = await triggerPanicButton({
    latitude,
    longitude,
    emergencyType: type,
    severity: severity || defaultSeverity,
    description: description || undefined,
    address,
  });
  return {
    ...result,
    message: "Tu reporte fue registrado y ya está en camino al centro de operaciones.",
  };
}

export async function validateEmergency(id) {
  const res = await apiFetch(`/api/emergencies/${id}/validate`, {
    method: "PATCH",
    body: {},
  });
  return res.data;
}

export async function closeEmergency(id) {
  const res = await apiFetch(`/api/emergencies/${id}/close`, {
    method: "PATCH",
    body: {},
  });
  return res.data;
}

export async function discardEmergency(id, reason) {
  const res = await apiFetch(`/api/emergencies/${id}/discard`, {
    method: "PATCH",
    body: { reason },
  });
  return res.data;
}

/**
 * @deprecated Stub 501: el backend todavía no expone prioridad manual
 * (HU-04). Ver Task Tracker issue #25. No debe invocarse ni mostrarse ninguna
 * acción que dependa de esto en pantallas del ciudadano.
 */
export async function overridePriority() {
  throw new ApiError("TODO(back): PATCH prioridad manual (HU-04)", {
    status: 501,
  });
}

export async function fetchOfficers({ status } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch(`/api/officers${query}`);
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

export async function assignOfficer(emergencyId, officerId) {
  const res = await apiFetch(`/api/emergencies/${emergencyId}/assign`, {
    method: "PATCH",
    body: { officerId },
  });
  const data = res?.data || res;
  return {
    success: true,
    status: data.status || "DISPATCHED",
    assignedOfficer: data.assignedOfficer || null,
    assignedOfficerId: data.assignedOfficerId || officerId,
    ...data,
  };
}

/**
 * Estados en los que el oficial todavía tiene algo que hacer. RESOLVED sale
 * de su lista: el cierre definitivo (CLOSED) lo hace el dispatcher.
 */
export const OFFICER_STATUSES = ["DISPATCHED", "EN_ROUTE", "ON_SCENE"];

/**
 * Emergencias asignadas al oficial logueado. El backend fuerza el filtro
 * assignedOfficerId = sub del token: acá no se manda.
 */
export async function fetchOfficerEmergencies() {
  const { data } = await fetchEmergenciesPage({
    status: OFFICER_STATUSES.join(","),
    limit: 100,
    sortBy: "priority",
    order: "desc",
  });
  return data;
}

/**
 * Próximo paso del oficial según el estado (máquina de estados del backend:
 * DISPATCHED → EN_ROUTE → ON_SCENE → RESOLVED). null si no hay acción.
 */
export const OFFICER_NEXT_STEP = {
  DISPATCHED: { action: "en-route", label: "En camino", icon: "directions_car" },
  EN_ROUTE: { action: "on-scene", label: "Llegué al lugar", icon: "location_on" },
  ON_SCENE: { action: "resolve", label: "Resolver", icon: "task_alt" },
};

/** PATCH /api/emergencies/:id/{en-route|on-scene|resolve} (solo oficial asignado). */
export async function advanceOfficerStatus(id, action, resolution = {}) {
  if (!["en-route", "on-scene", "resolve"].includes(action)) {
    throw new ApiError(`Acción de oficial desconocida: ${action}`, { status: 400 });
  }
  const res = await apiFetch(`/api/emergencies/${id}/${action}`, {
    method: "PATCH",
    body: action === "resolve" ? resolution : {},
  });
  return res?.data;
}

/**
 * @deprecated Stub 501: el backend todavía no expone observaciones/evidencias
 * (HU-09). Ver Task Tracker issue #23. No debe invocarse ni mostrarse ninguna
 * acción que dependa de esto en pantallas del ciudadano.
 */
export async function addObservation() {
  throw new ApiError("TODO(back): POST observaciones/evidencias (HU-09)", {
    status: 501,
  });
}

/**
 * @deprecated Stub 501: el backend todavía no expone pedido de refuerzos
 * (HU-10). Ver Task Tracker issue #29. No debe invocarse ni mostrarse ninguna
 * acción que dependa de esto en pantallas del ciudadano.
 */
export async function requestReinforcements() {
  throw new ApiError("TODO(back): POST refuerzos (HU-10)", { status: 501 });
}

export async function fetchEmergencyHistory(id) {
  const detail = await fetchEmergencyDetail(id);
  return Array.isArray(detail?.statusHistory) ? detail.statusHistory : [];
}

export class LocationError extends Error {
  constructor(message, code = "POSITION_UNAVAILABLE", originalError = null) {
    super(message);
    this.name = "LocationError";
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Obtiene la ubicación actual del dispositivo.
 *
 * NOTA DE SEGURIDAD:
 * Nunca se debe devolver una coordenada fija/falsa (-34.6037, -58.3816) de forma
 * silenciosa si la geolocalización falla, no está soportada o vence el timeout.
 * El SOS y los reportes de emergencias no deben enviar coordenadas ficticias
 * a las autoridades como si fueran la ubicación real del ciudadano.
 * Ante cualquier fallo o falta de permisos, esta función rechaza explícitamente
 * con una instancia de LocationError.
 *
 * @param {object} [options]
 * @param {boolean} [options.enableHighAccuracy=true]
 * @param {number} [options.timeout=8000]
 * @param {number} [options.maximumAge=60000]
 * @returns {Promise<{latitude: number, longitude: number, precise: boolean, accuracy?: number}>}
 */
export function getCurrentLocation(options = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 8000,
    maximumAge = 60000,
  } = options;

  if (typeof window !== "undefined" && window.__lastCoords) {
    return Promise.resolve({
      latitude: window.__lastCoords.latitude,
      longitude: window.__lastCoords.longitude,
      precise: window.__lastCoords.precise ?? true,
      accuracy: window.__lastCoords.accuracy,
    });
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new LocationError(
        "Este dispositivo o navegador no soporta geolocalización.",
        "NOT_SUPPORTED"
      )
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precise: true,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        let message = "No se pudo obtener tu ubicación actual.";
        let code = "POSITION_UNAVAILABLE";

        if (err) {
          switch (err.code) {
            case 1: // PERMISSION_DENIED
              code = "PERMISSION_DENIED";
              message = "Permiso de ubicación denegado. Habilitá la geolocalización en tu navegador para continuar.";
              break;
            case 2: // POSITION_UNAVAILABLE
              message = "Ubicación no disponible en este momento. Verificá la señal de GPS o conexión de red.";
              break;
            case 3: // TIMEOUT
              code = "TIMEOUT";
              message = "Tiempo de espera agotado al intentar determinar la ubicación.";
              break;
            default:
              message = err.message || message;
          }
        }

        reject(new LocationError(message, code, err));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  });
}

export { getStoredUser, setStoredUser };
export { getHomePathForUser } from "./auth";
