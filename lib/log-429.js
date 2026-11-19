/**
 * Registro único de los 429 (y de los bloqueos 403 de Cloudflare) que pasan
 * por este servidor.
 *
 * Cada uno deja UNA línea en el log de Render que empieza con `[<status>][<origen>]`,
 * así que buscar `[429]` encuentra todos, venga de donde venga:
 *
 *   [429][backend]    rate limit propio del backend (JSON)
 *   [429][cloudflare] Cloudflare cortó el pedido antes del backend
 *   [429][edge]       algo delante del backend, sin marcas de Cloudflare
 *   [429][ldap]       Login Federado del Grupo 2
 *   [429][analitica]  tablero de Analítica (lo reenvía el backend)
 *   [429][geocode]    proveedor de direcciones (BigDataCloud / Nominatim)
 *   [429][browser]    lo vio el navegador y nunca llegó a este servidor
 *                     (ver app/api/telemetry/429/route.js)
 *
 * La línea lleva lo que hace falta para rastrearlo: cf-ray (lo pide el soporte
 * de Render/Cloudflare), cf-mitigated, retry-after, server, content-type y el
 * comienzo del cuerpo sin HTML. Nunca tokens ni cookies.
 *
 * Las respuestas que este servidor devuelve con un 429 ya registrado llevan
 * `X-429-Logged: 1`: el navegador reporta solo los 429 sin esa marca, que son
 * los que no pasaron por acá.
 */
export const LOGGED_HEADER = "X-429-Logged";

function header(res, name) {
  return res?.headers?.get?.(name) || "-";
}

export function bodySnippet(text, max = 120) {
  return String(text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/"/g, "'");
}

/**
 * @param {object} args
 * @param {string} args.source backend | cloudflare | edge | ldap | analitica | geocode | browser
 * @param {string} args.method
 * @param {string} args.route ruta pedida (sin query ni datos personales)
 * @param {{ status?: number, headers?: { get(name: string): string|null } }} [args.res] respuesta de arriba
 * @param {number} [args.status] status, si no hay `res`
 * @param {string} [args.bodyText]
 * @param {string} [args.note] texto corto extra
 */
export function log429({ source, method, route, res, status, bodyText = "", note }) {
  const code = status ?? res?.status ?? 429;
  console.warn(
    `[${code}][${source}] ${method} ${route}` +
      ` cf-ray=${header(res, "cf-ray")} cf-mitigated=${header(res, "cf-mitigated")}` +
      ` retry-after=${header(res, "retry-after")} server=${header(res, "server")}` +
      ` content-type=${header(res, "content-type")}` +
      (note ? ` nota="${bodySnippet(note, 160)}"` : "") +
      ` cuerpo="${bodySnippet(bodyText)}"`
  );
}

/** Marca la respuesta como ya registrada (ver LOGGED_HEADER). */
export function markLogged(response) {
  response.headers.set(LOGGED_HEADER, "1");
  return response;
}
