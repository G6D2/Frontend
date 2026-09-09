/**
 * fetch hacia el backend con reintentos para el arranque en frío de Render.
 *
 * El plan free duerme el backend tras 15 minutos sin tráfico. Mientras el
 * contenedor levanta (10 a 60 s), Render responde 502/503 al instante en vez
 * de esperar. Sin esto, el primer login o la primera carga del dashboard
 * fallan con "Error HTTP 502" aunque el backend esté sano.
 *
 * Reintenta solo cuando la request no llegó a la app (502, 503, 504 o error de
 * red), así que es seguro también para POST/PATCH: el backend nunca la procesó.
 */
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export const DEFAULT_RETRY = Object.freeze({
  retries: 6, // ~6 x 4 s = 24 s de espera máxima, dentro del timeout de Render
  delayMs: 4000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBackend(url, init = {}, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRY.retries;
  const delayMs = options.delayMs ?? DEFAULT_RETRY.delayMs;
  const fetchImpl = options.fetchImpl || fetch;

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
