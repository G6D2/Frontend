import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
  getHomePathForUser,
} from "./auth";

export const POLLING_INTERVAL_MS = 5000;

// ── Endpoints vía BFF (/api/backend/*) con cookie httpOnly ───────────
// Contrato seguridad backend (2026-08):
// - lat/lng cifrados en reposo; respuesta puede traer locationAnonymized:true y coords null
// - body JSON máx 32kb; location.latitude/longitude deben ser number
// - CORS_ORIGIN en prod; el front usa BFF same-origin (no llama al API directo)
//
// TODO(back): POST reportar incidente (HU-02)
// TODO(back): PATCH validar / descartar (HU-05)
// TODO(back): PATCH prioridad (HU-04)
// TODO(back): oficiales / asignar (HU-06)
// TODO(back): estados oficial / observaciones / refuerzos (HU-08/09/10)
// TODO(back): historial timeline + live updates (HU-07/11)
// TODO(back): Auth IdP real (HU-12)
// TODO(back): Rol officer (HU-08+)
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
      clearStoredUser();
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
}) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sub, preferred_username, groups }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  setStoredUser(data.user);
  return { user: data.user };
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
    clearStoredUser();
    throw new ApiError(data?.message || "Sin sesión", {
      status: res.status,
      body: data,
    });
  }
  setStoredUser(data.data);
  return data.data;
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
  description = "Necesito ayuda inmediata",
  severity = "critical",
}) {
  // Backend exige numbers (AES location crypto + ValidationError si NaN/string)
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError("Ubicación inválida: latitude/longitude deben ser números", {
      status: 400,
    });
  }

  return apiFetch("/api/panic-button", {
    method: "POST",
    body: {
      location: { latitude: lat, longitude: lng },
      description,
      severity,
    },
  });
}

export async function fetchEmergencyById(id) {
  const res = await apiFetch(`/api/panic-button/${id}`);
  return res.data;
}

export async function fetchEmergencies() {
  const res = await apiFetch("/api/emergencies");
  return res.data || [];
}

export async function cancelEmergency(id, reason = null) {
  const res = await apiFetch(`/api/emergencies/${id}/cancel`, {
    method: "PATCH",
    body: reason ? { reason } : {},
  });
  return res.data;
}

export async function reportIncident() {
  throw new ApiError("TODO(back): POST reportar incidente (HU-02)", {
    status: 501,
  });
}

export async function validateEmergency() {
  throw new ApiError("TODO(back): PATCH validar emergencia (HU-05)", {
    status: 501,
  });
}

export async function discardEmergency() {
  throw new ApiError("TODO(back): PATCH descartar emergencia (HU-05)", {
    status: 501,
  });
}

export async function overridePriority() {
  throw new ApiError("TODO(back): PATCH prioridad manual (HU-04)", {
    status: 501,
  });
}

export async function fetchOfficers() {
  throw new ApiError("TODO(back): GET oficiales disponibles (HU-06)", {
    status: 501,
  });
}

export async function assignOfficer() {
  throw new ApiError("TODO(back): POST asignar oficial (HU-06)", {
    status: 501,
  });
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

export async function fetchEmergencyHistory() {
  throw new ApiError("TODO(back): GET historial de estados / timeline", {
    status: 501,
  });
}

export function getCurrentLocation() {
  const fallback = {
    latitude: -34.6037,
    longitude: -58.3816,
    precise: false,
  };

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

export { getStoredUser, getHomePathForUser, clearStoredUser as clearSession };
