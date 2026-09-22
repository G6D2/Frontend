/**
 * fetch hacia el backend con reintentos para el arranque en frío de Render.
 *
 * El plan free duerme el backend tras 15 minutos sin tráfico. Mientras el
 * contenedor levanta (10 a 60 s), Render responde 502/503 al instante en vez
 * de esperar. Sin esto, el primer login o la primera carga del dashboard
 * fallan con "Error HTTP 502" aunque el backend esté sano.
 *
 * Política de retry por método y tipo de error:
 * ------------------------------------------------
 * - Errores reintentables:
 *   - Códigos HTTP: 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout).
 *     Emitidos típicamente por el reverse proxy / load balancer (Render) durante cold start.
 *   - Errores de red (TypeError / fetch failed): backend caído o levantando.
 * - Errores NO reintentables:
 *   - Errores de aplicación (4xx de validación/autenticación, 500 de bug interno):
 *     no se reintentan y se devuelven inmediatamente al cliente.
 * - Métodos y política de idempotencia:
 *   - Métodos seguros / de consulta (GET, HEAD, OPTIONS): reintentos seguros por definición.
 *   - Métodos mutantes / altas (POST, PUT, PATCH): NO se puede asumir ciegamente que
 *     un 502 o 504 implique que la operación no fue procesada en el backend (la petición
 *     pudo ejecutarse antes de que el proxy cortara la conexión o agotara el timeout).
 *     Para que el retry automático ante cold start sea seguro también para POST/PATCH,
 *     se incorpora automáticamente un header `Idempotency-Key` (UUID v4) único por request
 *     lógica, generado ANTES del loop de reintentos y preservado a lo largo de todos los
 *     intentos. Esto permite que el backend identifique peticiones duplicadas y garantice
 *     idempotencia en altas y modificaciones.
 */

export const RETRYABLE_STATUS = new Set([502, 503, 504]);
export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH"]);
export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "DELETE"]);

export const DEFAULT_RETRY = Object.freeze({
  retries: 6, // ~6 x 4 s = 24 s de espera máxima, dentro del timeout de Render
  delayMs: 4000,
});

export function isRetryableStatus(status) {
  return RETRYABLE_STATUS.has(status);
}

export function isMutatingMethod(method = "GET") {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Genera un UUID v4 para usar como Idempotency-Key.
 * Exportado para que call-sites directos puedan generar la suya si es necesario.
 */
export function generateIdempotencyKey() {
  return crypto.randomUUID();
}

export async function fetchBackend(url, init = {}, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRY.retries;
  const delayMs = options.delayMs ?? DEFAULT_RETRY.delayMs;
  const fetchImpl = options.fetchImpl || fetch;

  const method = (init.method || "GET").toUpperCase();

  // Para métodos mutantes (altas / modificaciones), asegurar Idempotency-Key
  // generado una sola vez antes del loop para que todos los reintentos
  // compartan la misma identidad lógica de operación.
  if (MUTATING_METHODS.has(method)) {
    const headers = init.headers instanceof Headers
      ? init.headers
      : new Headers(init.headers || {});

    if (!headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", generateIdempotencyKey());
    }

    init = { ...init, headers };
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, init);
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res;
      }
      lastError = new Error(`Backend respondió ${res.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }
    await sleep(delayMs);
  }
  throw lastError;
}
