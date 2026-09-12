/**
 * Datos personales del ciudadano, guardados localmente en el dispositivo.
 *
 * TODO(back): hoy no existe un perfil de ciudadano en el backend, así que
 * esto vive en localStorage. El día que exista GET/PUT /api/perfil,
 * reemplazar por llamadas reales y usar esto solo como caché offline.
 */

const STORAGE_KEY = "citypass_personal_data";

const EMPTY_PERSONAL_DATA = {
  name: "",
  phone: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalCondition: "",
};

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

/** Devuelve los datos guardados, o el objeto vacío si no hay nada (o el storage no está disponible). */
export function getPersonalData() {
  if (!hasLocalStorage()) return { ...EMPTY_PERSONAL_DATA };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PERSONAL_DATA };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_PERSONAL_DATA };
    return { ...EMPTY_PERSONAL_DATA, ...parsed };
  } catch {
    return { ...EMPTY_PERSONAL_DATA };
  }
}

/** Guarda los datos personales. Devuelve true si se pudo persistir. */
export function savePersonalData(data) {
  if (!hasLocalStorage()) return false;
  try {
    const merged = { ...EMPTY_PERSONAL_DATA, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
}

/** Borra los datos personales guardados en este dispositivo. */
export function clearPersonalData() {
  if (!hasLocalStorage()) return false;
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export { STORAGE_KEY as PERSONAL_DATA_STORAGE_KEY, EMPTY_PERSONAL_DATA };
