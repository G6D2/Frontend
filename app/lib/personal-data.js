/**
 * Datos personales del ciudadano vía backend (cifrados en reposo).
 * Purga restos legacy de localStorage si quedaban de versiones anteriores.
 */

import {
  fetchCitizenProfile,
  saveCitizenProfile,
} from "./citizen-profile-api.js";

const LEGACY_STORAGE_KEY = "citypass_personal_data";

export const EMPTY_PERSONAL_DATA = {
  name: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalCondition: "",
};

export function purgeLegacyPersonalDataStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Carga el perfil desde el backend. */
export async function getPersonalData() {
  purgeLegacyPersonalDataStorage();
  const data = await fetchCitizenProfile();
  return { ...EMPTY_PERSONAL_DATA, ...data };
}

/** Persiste el perfil en el backend. Devuelve true si OK. */
export async function savePersonalData(data) {
  purgeLegacyPersonalDataStorage();
  await saveCitizenProfile(data);
  return true;
}

export { LEGACY_STORAGE_KEY as PERSONAL_DATA_STORAGE_KEY };
