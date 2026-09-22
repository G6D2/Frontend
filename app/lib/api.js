import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
  getHomePathForUser,
} from "./auth";
import { SEVERITY_CONFIG } from "./emergencies";

/** Intervalo de polling para el dispatcher (1 minuto). Reduce carga en el backend. */
export const POLLING_INTERVAL_MS = 60_000;
/** Intervalo de polling para la vista del ciudadano (5 s). Permite actualizaciones
 *  casi en tiempo real del historial de estados sin sobrecargar el sistema,
 *  dado que la carga de ciudadanos simultáneos es menor que la del dispatcher. */
export const CITIZEN_POLLING_INTERVAL_MS = 5_000;

function redirectToLogin() {
  clearStoredUser();
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

  const normalizedPath =
    path.startsWith("/api/") ? path.slice(4) : path;
  const url = auth ? `/api/backend${normalizedPath}` : path;

  let res;
  beginBackendCall();
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    endBackendCall();
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Error HTTP ${res.status}`;
    if (res.status === 401) {
      redirectToLogin();
    }
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

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  clearStoredUser();
}

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

export async function hasValidSession() {
  try {
    await fetchCurrentUser();
    return true;
  } catch {
    return false;
  }
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

export const STATUS_CONFIG = [
  { key: "pendiente", label: "Pendientes", color: "red" },
  { key: "validada", label: "Validadas", color: "orange" },
  { key: "despachada", label: "Despachadas", color: "yellow" },
  { key: "en_camino", label: "En Camino", color: "cyan" },
  { key: "en_lugar", label: "En Lugar", color: "indigo" },
  { key: "resuelta", label: "Resuelta", color: "teal" },
  { key: "cerrada", label: "Cerrada", color: "gray" },
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
  return triggerPanicButton({
    latitude,
    longitude,
    emergencyType: type,
    severity: severity || defaultSeverity,
    description: description || undefined,
    address,
  });
}

export async function validateEmergency(id) {
  const res = await apiFetch(`/api/emergencies/${id}/validate`, {
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
 * @deprecated Stub 501: el backend todavía no expone estados de oficial
 * EN_ROUTE/ON_SITE/RESOLVED (HU-08). Ver Task Tracker issue #21. No debe
 * invocarse ni mostrarse ninguna acción que dependa de esto en pantallas del
 * ciudadano.
 */
export async function updateEmergencyStatus() {
  throw new ApiError(
    "TODO(back): PATCH estado EN_ROUTE/ON_SITE/RESOLVED (HU-08)",
    { status: 501 }
  );
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

export { getStoredUser, setStoredUser, getHomePathForUser, clearStoredUser as clearSession };
