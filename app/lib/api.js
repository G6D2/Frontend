import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
  getHomePathForUser,
} from "./auth";
import { SEVERITY_CONFIG } from "./emergencies";

export const POLLING_INTERVAL_MS = 5000;

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

  const url = auth ? `/api/backend${path}` : path;
  const res = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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

export async function triggerPanicButton({
  latitude,
  longitude,
  description,
  severity = "critical",
  emergencyType = "panic",
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
  const res = await apiFetch("/api/emergencies?limit=100&sortBy=createdAt&order=desc");
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
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

export async function updateEmergencyStatus() {
  throw new ApiError(
    "TODO(back): PATCH estado EN_ROUTE/ON_SITE/RESOLVED (HU-08)",
    { status: 501 }
  );
}

export async function addObservation() {
  throw new ApiError("TODO(back): POST observaciones/evidencias (HU-09)", {
    status: 501,
  });
}

export async function requestReinforcements() {
  throw new ApiError("TODO(back): POST refuerzos (HU-10)", { status: 501 });
}

export async function fetchEmergencyHistory(id) {
  const detail = await fetchEmergencyDetail(id);
  return Array.isArray(detail?.statusHistory) ? detail.statusHistory : [];
}

export function getCurrentLocation() {
  const fallback = {
    latitude: -34.6037,
    longitude: -58.3816,
    precise: false,
  };

  if (typeof window !== "undefined" && window.__lastCoords) {
    return Promise.resolve(window.__lastCoords);
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(fallback);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precise: true,
        });
      },
      () => resolve(fallback),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export { getStoredUser, setStoredUser, getHomePathForUser, clearStoredUser as clearSession };
