/**
 * Ubicaciones guardadas del ciudadano (Casa, Trabajo, otras), en localStorage.
 *
 * TODO(back): no existe todavía un endpoint de ubicaciones guardadas por
 * ciudadano. Cuando exista, migrar esto a llamadas al backend y dejar
 * localStorage solo como caché offline.
 *
 * TODO(front): app/(citizen)/reportar/ReportarClient.js no tiene hoy un
 * selector de ubicación guardada al reportar un incidente. Cuando lo tenga,
 * debería poder elegir una de estas ubicaciones en vez de (o además de) la
 * geolocalización automática. Ver README de esta sección.
 */

const STORAGE_KEY = "citypass_saved_locations";

function hasLocalStorage() {
  return typeof localStorage !== "undefined";
}

function genId() {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Devuelve la lista de ubicaciones guardadas (vacía si no hay storage o no hay datos). */
export function getSavedLocations() {
  if (!hasLocalStorage()) return [];
  return readList();
}

/** Agrega una ubicación nueva. Devuelve la entrada creada, o null si no se pudo guardar. */
export function addSavedLocation({ label, address, lat, lng } = {}) {
  if (!hasLocalStorage()) return null;
  const entry = {
    id: genId(),
    label: (label || "").trim(),
    address: (address || "").trim(),
    lat: typeof lat === "number" && !Number.isNaN(lat) ? lat : null,
    lng: typeof lng === "number" && !Number.isNaN(lng) ? lng : null,
  };
  const list = readList();
  const ok = writeList([...list, entry]);
  return ok ? entry : null;
}

/** Actualiza una ubicación existente por id. Devuelve true si se encontró y se guardó. */
export function updateSavedLocation(id, changes = {}) {
  if (!hasLocalStorage()) return false;
  const list = readList();
  const idx = list.findIndex((loc) => loc.id === id);
  if (idx === -1) return false;
  const current = list[idx];
  const next = {
    ...current,
    ...changes,
    id: current.id,
  };
  const updatedList = [...list];
  updatedList[idx] = next;
  return writeList(updatedList);
}

/** Elimina una ubicación por id. Devuelve true si se guardó la lista resultante. */
export function removeSavedLocation(id) {
  if (!hasLocalStorage()) return false;
  const list = readList();
  const next = list.filter((loc) => loc.id !== id);
  return writeList(next);
}

export { STORAGE_KEY as SAVED_LOCATIONS_STORAGE_KEY };
