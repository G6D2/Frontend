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
 * - Errores de aplicación (4xx de validación/autenticación, 500 de bug
 *   interno): nunca se reintentan y se devuelven inmediatamente al cliente.
 * - GET, HEAD, OPTIONS, PUT y DELETE (idempotentes por definición HTTP: repetirlos
 *   deja al backend en el mismo estado): se reintentan ante 502, 503, 504 y
 *   cualquier error de red o timeout.
 * - POST y PATCH (no idempotentes: un POST /api/panic-button repetido es un SOS
 *   duplicado): se reintentan solo cuando la request no llegó a la app:
 *   - 502 y 503, que Render responde cuando no pudo entregarle la request al
 *     contenedor (por ejemplo, mientras levanta);
 *   - errores de conexión (ECONNREFUSED, DNS, timeout de connect): la request
 *     nunca salió.
 *   NO se reintentan el 504 (el backend pudo recibir la request y seguir
 *   procesándola cuando el proxy cortó) ni los errores después de conectar
 *   (conexión cortada, timeout del intento): no se sabe si la operación se
 *   aplicó, así que el error vuelve al cliente en vez de arriesgar un duplicado.
 *
 * Idempotency-Key: para POST/PUT/PATCH se manda un UUID v4 por request lógica,
 * generado antes del loop y el mismo en todos los intentos. Hoy el backend NO
 * la implementa (no deduplica nada), así que la política de arriba no cuenta
 * con ella; se manda para cuando el backend la soporte.
 *
 * Cada intento tiene su propio timeout (AbortSignal.timeout) para que un
 * backend colgado no deje la request abierta indefinidamente.
 */

export const RETRYABLE_STATUS = new Set([502, 503, 504]);
/** Subconjunto seguro para POST/PATCH: la request no llegó a la app. */
export const NON_IDEMPOTENT_RETRYABLE_STATUS = new Set([502, 503]);
export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH"]);
export const NON_IDEMPOTENT_METHODS = new Set(["POST", "PATCH"]);
export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "DELETE"]);

/**
 * Códigos de error de undici (fetch de Node) que se producen antes de mandar
 * la request: el backend no la recibió. Vienen en `error.cause.code`.
 */
const CONNECT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export const DEFAULT_RETRY = Object.freeze({
  retries: 6, // ~6 x 4 s = 24 s de espera máxima, dentro del timeout de Render
  delayMs: 4000,
  timeoutMs: 20_000, // por intento; mismo margen que /api/warmup
});

export function isNonIdempotentMethod(method = "GET") {
  return NON_IDEMPOTENT_METHODS.has(method.toUpperCase());
}

export function isRetryableStatus(status, method = "GET") {
  return isNonIdempotentMethod(method)
    ? NON_IDEMPOTENT_RETRYABLE_STATUS.has(status)
    : RETRYABLE_STATUS.has(status);
}

export function isConnectError(error) {
  return CONNECT_ERROR_CODES.has(error?.cause?.code ?? error?.code);
}

export function isRetryableError(error, method = "GET") {
  return isNonIdempotentMethod(method) ? isConnectError(error) : true;
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

function attemptSignal(callerSignal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
}

export async function fetchBackend(url, init = {}, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRY.retries;
  const delayMs = options.delayMs ?? DEFAULT_RETRY.delayMs;
  const timeoutMs = options.timeoutMs ?? DEFAULT_RETRY.timeoutMs;
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
    const attemptInit = { ...init, signal: attemptSignal(init.signal, timeoutMs) };
    try {
      const res = await fetchImpl(url, attemptInit);
      if (!isRetryableStatus(res.status, method) || attempt === retries) {
        return res;
      }
      lastError = new Error(`Backend respondió ${res.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error, method)) throw error;
    }
    await sleep(delayMs);
  }
  throw lastError;
}
