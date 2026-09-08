/**
 * Geocodificación inversa (lat/lng → dirección legible) usando Nominatim (OpenStreetMap).
 * Gratuito, sin API key. Límite de uso: 1 req/seg por IP (uso razonable).
 *
 * Referencia: https://nominatim.org/release-docs/latest/api/Reverse/
 */

/** Caché en memoria para evitar llamadas duplicadas durante la misma sesión. */
const cache = new Map();

/**
 * Convierte coordenadas a una dirección humana vía Nominatim.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>} Dirección legible o null si falla.
 */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Redondear a 5 decimales para usar como clave de caché (~1m de precisión)
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
      {
        headers: {
          // Nominatim requiere un User-Agent descriptivo
          "User-Agent": "CityPass-Emergencias/1.0",
        },
        // No enviar cookies de sesión a dominios externos
        credentials: "omit",
        cache: "force-cache",
      }
    );

    if (!res.ok) return null;

    const data = await res.json();

    // Construir una dirección corta y legible priorizando campos urbanos
    const addr = data.address || {};
    const parts = [
      addr.road || addr.pedestrian || addr.footway || addr.cycleway,
      addr.house_number,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.city || addr.town || addr.village || addr.municipality,
    ].filter(Boolean);

    const label = parts.length > 0 ? parts.join(", ") : data.display_name;

    if (label) {
      cache.set(key, label);
      return label;
    }
  } catch {
    // Silencioso: no bloquear la UI si Nominatim no responde
  }

  return null;
}
