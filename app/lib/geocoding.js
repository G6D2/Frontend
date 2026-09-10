/**
 * Geocodificación inversa (lat/lng → dirección legible).
 *
 * El browser NO habla con Nominatim directamente: la lista dispara muchas
 * consultas a la vez y Nominatim (1 req/s por IP) deja las conexiones
 * colgadas o responde 503, con lo que "Obteniendo dirección…" quedaba fijo.
 * Ahora pasa por el BFF (/api/geocode), que cachea, agrupa y serializa.
 */

/** Caché en memoria del cliente para no repetir dentro de la misma sesión. */
const cache = new Map();
const CLIENT_TIMEOUT_MS = 15000;

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>} Dirección legible o null si falla o tarda.
 */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, {
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const label = data?.label || null;
    if (label) cache.set(key, label);
    return label;
  } catch {
    // Silencioso: GeoLabel cae a mostrar las coordenadas.
    return null;
  }
}
