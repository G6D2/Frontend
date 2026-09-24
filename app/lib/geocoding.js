/**
 * Geocodificación inversa (lat/lng → dirección legible).
 *
 * El browser NO habla con Nominatim directamente: la lista dispara muchas
 * consultas a la vez y Nominatim (1 req/s por IP) deja las conexiones
 * colgadas o responde 503, con lo que "Obteniendo dirección…" quedaba fijo.
 * Ahora pasa por el BFF (/api/geocode), que cachea, agrupa y serializa.
 */

import { hasValidCoords, locationLabel } from "./emergencies";

/** Caché en memoria del cliente para no repetir dentro de la misma sesión. */
const cache = new Map();
const CLIENT_TIMEOUT_MS = 15000;

/**
 * @param {number} lat
 * @param {number} lng
 * @param {object} [options]
 * @param {number} [options.timeoutMs] Timeout del fetch al BFF. Default 15s
 *   (uso general de GeoLabel). El flujo de SOS/Reportar usa uno más corto
 *   (~2.5s, ver SOS_ADDRESS_TIMEOUT_MS en lib/sosController.js) para no
 *   demorar el envío de la alerta esperando una dirección legible.
 * @returns {Promise<string|null>} Dirección legible o null si falla o tarda.
 */
export function reverseGeocode(lat, lng, { timeoutMs = CLIENT_TIMEOUT_MS } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null);

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  // Cachea la PROMESA (no solo el resultado): varios GeoLabel y cada ciclo de
  // polling piden la misma coordenada casi a la vez; guardar la promesa en
  // vuelo evita disparar N fetch idénticos al /api/geocode por la misma coord.
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const pending = (async () => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.label || null;
    } catch {
      // Silencioso: GeoLabel cae a mostrar las coordenadas.
      return null;
    }
  })();

  cache.set(key, pending);
  // Si la resolución no trajo dirección (falla/timeout/sin label), se desaloja
  // para permitir un reintento más adelante; una dirección válida queda cacheada.
  pending
    .then((label) => {
      if (!label) cache.delete(key);
    })
    .catch(() => cache.delete(key));

  return pending;
}

/**
 * Resuelve qué dirección mostrar para una emergencia, priorizando lo que ya
 * trae el backend (contrato 2026-09: `address: string|null` en listado y
 * detalle de /api/emergencies) para no pagar una geocodificación inversa de
 * más. Solo indica que hace falta geocodificar del lado cliente
 * (`needsGeocode: true`) cuando el backend no mandó dirección pero sí hay
 * coordenadas usables.
 *
 * Función pura (no llama a la red): quien la usa decide qué hacer con
 * `needsGeocode` (ej. GeoLabel dispara `reverseGeocode(lat, lng)`).
 *
 * @param {object} emergency
 * @returns {{ label: string|null, needsGeocode: boolean }}
 *   label: dirección conocida sin red, o null si todavía no hay nada que
 *     mostrar (need geocode) o directamente no hay ubicación.
 *   needsGeocode: true si conviene llamar a reverseGeocode(lat, lng).
 */
export function resolveEmergencyAddress(emergency) {
  if (!emergency) return { label: null, needsGeocode: false };

  if (emergency.locationAnonymized) {
    return { label: "Ubicación anonimizada (retención)", needsGeocode: false };
  }
  if (emergency.locationUnavailable) {
    return { label: "Sin ubicación", needsGeocode: false };
  }
  // El backend puede mandar address: null explícito (no anonimizada, sin
  // dirección resuelta todavía) o directamente no incluir el campo (fixtures
  // / tests viejos): en ambos casos, si no vino string, seguimos probando.
  if (typeof emergency.address === "string" && emergency.address.trim()) {
    return { label: emergency.address, needsGeocode: false };
  }
  // Compat: locationLabel legado (algunas vistas/fixtures todavía lo usan).
  if (emergency.locationLabel) {
    return { label: emergency.locationLabel, needsGeocode: false };
  }
  if (hasValidCoords(emergency)) {
    return { label: null, needsGeocode: true };
  }
  return { label: locationLabel(emergency), needsGeocode: false };
}
