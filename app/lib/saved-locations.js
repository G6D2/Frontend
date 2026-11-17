/**
 * Ubicaciones frecuentes del ciudadano vía backend (cifradas en reposo).
 * Purga restos legacy de localStorage si quedaban de versiones anteriores.
 */

import {
  fetchSavedLocations,
  createSavedLocation,
  patchSavedLocation,
  deleteSavedLocation,
} from "./citizen-profile-api.js";

const LEGACY_STORAGE_KEY = "citypass_saved_locations";

export function purgeLegacySavedLocationsStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function getSavedLocations() {
  purgeLegacySavedLocationsStorage();
  return fetchSavedLocations();
}

export async function addSavedLocation({ label, address, lat, lng } = {}) {
  purgeLegacySavedLocationsStorage();
  return createSavedLocation({ label, address, lat, lng });
}

export async function updateSavedLocation(id, changes = {}) {
  purgeLegacySavedLocationsStorage();
  await patchSavedLocation(id, changes);
  return true;
}

export async function removeSavedLocation(id) {
  purgeLegacySavedLocationsStorage();
  await deleteSavedLocation(id);
  return true;
}

export { LEGACY_STORAGE_KEY as SAVED_LOCATIONS_STORAGE_KEY };
