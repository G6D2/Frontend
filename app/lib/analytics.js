/**
 * Módulo de analítica para dispatchers (/ops/analitica).
 *
 * El backend de analítica de CityPass+ sirve el tablero de emergencias como un
 * único HTML autocontenido (datos, JS y CSS inline; no carga assets ni hace
 * fetch en modo embebido). Exige `Authorization: Bearer <access_token humano
 * del Login Federado>` (aud citypass-emergencias-api) y solo verifica que la
 * petición venga de nuestra app con el módulo: el control de rol es nuestro.
 *
 * Un iframe no puede mandar headers y el token está en una cookie httpOnly, así
 * que el iframe carga ANALYTICS_PROXY_PATH y el BFF (app/api/analytics/route.js)
 * pide el tablero con el Bearer.
 *
 * Se puede cambiar por entorno con ANALYTICS_EMBED_URL (lo lee solo el server).
 */
export const DEFAULT_ANALYTICS_EMBED_URL =
  "https://citypass-backend-prod-becqetepcjbqa8c7.brazilsouth-01.azurewebsites.net/embed/emergencias";

/** Ruta del BFF que sirve el tablero (la que carga el iframe). */
export const ANALYTICS_PROXY_PATH = "/api/analytics";

/** URL del tablero en el backend de analítica. Solo del lado del servidor. */
export function analyticsEmbedUrl() {
  return process.env.ANALYTICS_EMBED_URL || DEFAULT_ANALYTICS_EMBED_URL;
}
