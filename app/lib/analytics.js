/**
 * Módulo de analítica para dispatchers: lo sirve el backend de CityPass+ como
 * un HTML embebible y el front solo lo muestra en un iframe (/ops/analitica).
 *
 * Se puede cambiar por entorno con NEXT_PUBLIC_ANALYTICS_EMBED_URL (se lee al
 * hacer el build, tanto acá como en el CSP de next.config.mjs).
 */
export const DEFAULT_ANALYTICS_EMBED_URL =
  "https://citypass-backend-prod-becqetepcjbqa8c7.brazilsouth-01.azurewebsites.net/embed/";

export const ANALYTICS_EMBED_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_EMBED_URL || DEFAULT_ANALYTICS_EMBED_URL;

/** Origen (scheme://host[:port]) de la URL, para el frame-src del CSP. */
export function analyticsFrameOrigin(url = ANALYTICS_EMBED_URL) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
