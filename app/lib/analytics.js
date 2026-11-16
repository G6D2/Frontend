/**
 * Módulo de analítica para dispatchers: el backend de analítica de CityPass+
 * sirve un HTML embebible (/embed/) que exige `Authorization: Bearer <token>`
 * con el access_token del IdP (Login Federado / LDAP).
 *
 * Un iframe no puede mandar headers y el token vive en una cookie httpOnly,
 * así que el iframe no apunta al backend de analítica sino al BFF
 * (/api/analytics/..., ver app/api/analytics/[[...path]]/route.js), que agrega
 * el Bearer del lado del servidor y devuelve la respuesta desde nuestro origen.
 *
 * Se puede cambiar por entorno con NEXT_PUBLIC_ANALYTICS_EMBED_URL (se lee al
 * hacer el build).
 */
export const DEFAULT_ANALYTICS_EMBED_URL =
  "https://citypass-backend-prod-becqetepcjbqa8c7.brazilsouth-01.azurewebsites.net/embed/";

export const ANALYTICS_EMBED_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_EMBED_URL || DEFAULT_ANALYTICS_EMBED_URL;

/** Prefijo del proxy del BFF: /api/analytics/<path> → <origen>/<path>. */
export const ANALYTICS_PROXY_PREFIX = "/api/analytics";

/** Origen (scheme://host[:port]) del backend de analítica, o null si la URL es inválida. */
export function analyticsOrigin(url = ANALYTICS_EMBED_URL) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** URL (de nuestro origen) que carga el iframe: el embed pasando por el proxy. */
export function analyticsProxyUrl(url = ANALYTICS_EMBED_URL) {
  try {
    const { pathname, search } = new URL(url);
    return `${ANALYTICS_PROXY_PREFIX}${pathname}${search}`;
  } catch {
    return `${ANALYTICS_PROXY_PREFIX}/embed/`;
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reescribe las URLs de un documento del embed para que sigan pasando por el
 * proxy (si no, el browser las pediría a nuestro origen sin prefijo, o directo
 * al backend de analítica sin el Bearer):
 *  - URLs absolutas al backend de analítica → /api/analytics/...
 *  - en HTML, atributos src/href/action/poster con path absoluto ("/x", no
 *    "//x") → /api/analytics/x
 * Las URLs relativas ("app.js", "./data") ya resuelven bajo /api/analytics/.
 */
export function rewriteAnalyticsUrls(body, { origin, html }) {
  let out = body;
  if (origin) {
    out = out.replace(
      new RegExp(`${escapeRegExp(origin)}(?=[/"'\`?#\\s)]|$)`, "g"),
      ANALYTICS_PROXY_PREFIX
    );
  }
  if (html) {
    const prefix = ANALYTICS_PROXY_PREFIX;
    out = out.replace(
      /(\s(?:src|href|action|poster)\s*=\s*["'])\/(?!\/)/gi,
      (match, attr, offset, whole) =>
        whole.startsWith(`${prefix}/`, offset + attr.length) ? match : `${attr}${prefix}/`
    );
  }
  return out;
}
