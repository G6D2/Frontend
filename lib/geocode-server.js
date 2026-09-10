/**
 * Geocodificación inversa del lado del servidor (BFF), con caché y cola.
 *
 * Por qué acá y no en el browser: Nominatim (OpenStreetMap) limita a 1 req/s
 * por IP y ante ráfagas deja las conexiones colgadas o responde 503. La lista
 * de alertas dispara una consulta por tarjeta al mismo tiempo, así que desde
 * el navegador del usuario quedaba "Obteniendo dirección…" para siempre.
 *
 * Acá: se redondea la coordenada (4 decimales ≈ 11 m) para que filas cercanas
 * compartan resultado, se cachea en memoria 24 h, se agrupan pedidos iguales
 * en vuelo, y se serializa la salida a Nominatim a 1 req/s con User-Agent
 * identificable (lo pide su política de uso). Si falla o tarda, devuelve null
 * y el cliente muestra las coordenadas.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 1100; // política de Nominatim: máximo 1 request por segundo
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT = "CityPass-Emergencias/1.0 (TP UADE DA2; contacto: 2026g6d2@gmail.com)";

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

async function fetchNominatim(lat, lng, fetchImpl) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
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

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now()) return cached.label;
  if (inflight.has(key)) return inflight.get(key);

  const task = queue.then(async () => {
    const gap = MIN_GAP_MS - (now() - lastRequestAt);
    if (gap > 0) await wait(gap);
    lastRequestAt = now();
    try {
      return await fetchNominatim(lat, lng, fetchImpl);
    } catch {
      return null;
    }
  });
  // La cola sigue aunque un pedido falle.
  queue = task.catch(() => null);

  const promise = task.then((label) => {
    if (label) cache.set(key, { label, expiresAt: now() + CACHE_TTL_MS });
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
