/**
 * Cliente HTTP del perfil ciudadano (vía BFF). Separado de api.js para
 * evitar dependencia circular con personal-data / saved-locations.
 */

import { clearStoredUser } from "./auth.js";

export class CitizenProfileApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "CitizenProfileApiError";
    this.status = status;
    this.body = body;
  }
}

function purgeLegacyCitizenLocalStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem("citypass_personal_data");
    localStorage.removeItem("citypass_saved_locations");
  } catch {
    // ignore
  }
}

function redirectToLogin() {
  clearStoredUser();
  purgeLegacyCitizenLocalStorage();
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/acceso")) return;
  window.location.replace("/acceso");
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function citizenFetch(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api/backend${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    if (res.status === 401) {
      redirectToLogin();
    }
    throw new CitizenProfileApiError(
      data?.message || data?.error || `Error HTTP ${res.status}`,
      { status: res.status, body: data }
    );
  }
  return data;
}

export async function fetchCitizenProfile() {
  const res = await citizenFetch("/api/citizen/profile");
  return res?.data || {};
}

export async function saveCitizenProfile(profile) {
  const res = await citizenFetch("/api/citizen/profile", {
    method: "PUT",
    body: profile,
  });
  return res?.data || {};
}

export async function fetchSavedLocations() {
  const res = await citizenFetch("/api/citizen/saved-locations");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function createSavedLocation(payload) {
  const res = await citizenFetch("/api/citizen/saved-locations", {
    method: "POST",
    body: payload,
  });
  return res?.data || null;
}

export async function patchSavedLocation(id, changes) {
  const res = await citizenFetch(`/api/citizen/saved-locations/${id}`, {
    method: "PATCH",
    body: changes,
  });
  return res?.data || null;
}

export async function deleteSavedLocation(id) {
  await citizenFetch(`/api/citizen/saved-locations/${id}`, {
    method: "DELETE",
  });
  return true;
}
