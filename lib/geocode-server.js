import { log429 } from "@/lib/log-429";

/**
 * Geocodificación inversa del lado del servidor (BFF), con caché y cola.
 *
 * Por qué acá y no en el browser: Nominatim (OpenStreetMap) limita a 1 req/s
 * por IP y ante ráfagas deja las conexiones colgadas o responde 503. La lista
 * de alertas dispara una consulta por tarjeta al mismo tiempo, así que desde
 * el navegador del usuario quedaba "Obteniendo dirección…" para siempre.
 *
 * Acá: se redondea la coordenada (4 decimales ≈ 11 m) para que filas cercanas
 * compartan resultado, se cachea en memoria 24 h (LRU con tope de entradas,
 * para que la memoria no crezca sin límite), se agrupan pedidos iguales
 * en vuelo, y se serializa la salida a Nominatim a 1 req/s con User-Agent
 * identificable (lo pide su política de uso). Si falla o tarda, devuelve null
 * y el cliente muestra las coordenadas.
 *
 * Proveedor primario: BigDataCloud (reverse-geocode-client), gratuito, sin
 * clave, sin límite por segundo, pensado para uso desde apps; responde en
 * menos de 1 s con barrio y ciudad. Nominatim queda como respaldo con calle y
 * altura, pero desde Render y desde redes compartidas suele colgar o dar 503
 * (verificado 10/09), por eso ya no es el primero.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Tope de la caché: al pasarlo se descarta la entrada usada hace más tiempo.
export const CACHE_MAX_ENTRIES = 5000;
const MIN_GAP_MS = 1100; // política de Nominatim: máximo 1 request por segundo
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT = "CityPass-Emergencias/1.0 (TP UADE DA2; contacto: 2026g6d2@gmail.com)";

// LRU sobre Map: el Map conserva el orden de inserción, así que la primera
// clave es la usada hace más tiempo. Cada hit la vuelve a insertar al final.
const cache = new Map(); // key -> { label, expiresAt }
const inflight = new Map(); // key -> Promise<string|null>
let queue = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function cacheGet(key, now) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  cache.delete(key);
  if (entry.expiresAt <= now) return undefined;
  cache.set(key, entry);
  return entry.label;
}

function cacheSet(key, label, now) {
  cache.delete(key);
  cache.set(key, { label, expiresAt: now + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

export function buildLabel(data) {
  const addr = data?.address || {};
  const parts = [
    addr.road || addr.pedestrian || addr.footway || addr.cycleway,
    addr.house_number,
    addr.suburb || addr.neighbourhood || addr.quarter,
    addr.city || addr.town || addr.village || addr.municipality,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return data?.display_name || null;
}

export function buildLabelBigDataCloud(data) {
  if (!data) return null;
  const parts = [data.locality, data.city, data.principalSubdivision]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return parts.length > 0 ? parts.join(", ") : null;
}

async function fetchBigDataCloud(lat, lng, fetchImpl) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
  const res = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 429) {
    log429({ source: "geocode", method: "GET", route: "bigdatacloud reverse-geocode-client", res });
  }
  if (!res.ok) return null;
  return buildLabelBigDataCloud(await res.json());
}

async function fetchNominatim(lat, lng, fetchImpl) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 429) {
    log429({ source: "geocode", method: "GET", route: "nominatim reverse", res });
  }
  if (!res.ok) return null;
  return buildLabel(await res.json());
}

/**
 * Devuelve la dirección para (lat, lng) o null. Nunca lanza.
 * `deps` permite inyectar fetch/now/sleep en tests.
 */
export async function reverseGeocodeServer(lat, lng, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const now = deps.now || Date.now;
  const wait = deps.sleep || sleep;
  const key = cacheKey(lat, lng);

  const cached = cacheGet(key, now());
  if (cached !== undefined) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    // 1) BigDataCloud: rápido y sin cola.
    try {
      const label = await fetchBigDataCloud(lat, lng, fetchImpl);
      if (label) return label;
    } catch {
      // sigue al respaldo
    }
    // 2) Nominatim, serializado a 1 req/s.
    const previous = queue;
    const run = previous.then(async () => {
      const gap = MIN_GAP_MS - (now() - lastRequestAt);
      if (gap > 0) await wait(gap);
      lastRequestAt = now();
      try {
        return await fetchNominatim(lat, lng, fetchImpl);
      } catch {
        return null;
      }
    });
    queue = run.catch(() => null);
    return run;
  })();
  const promise = task.then((label) => {
    if (label) cacheSet(key, label, now());
    return label;
  }).finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/** Solo para tests. */
export function _resetGeocodeState() {
  cache.clear();
  inflight.clear();
  queue = Promise.resolve();
  lastRequestAt = 0;
}
