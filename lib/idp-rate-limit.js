import { NextResponse } from "next/server";

/**
 * 429 del Login Federado (LDAP del Grupo 2).
 *
 * El IdP limita /auth/login y /auth/refresh a 30 intentos por IP cada 15 min.
 * Todo el personal entra a través de este servidor (el BFF), así que para el
 * IdP somos una sola IP y ese cupo se comparte entre todos. Cuando se agota,
 * el 429 no es nuestro: esta respuesta lo deja identificado para el browser
 * (`reason`, `source`, mensaje) y para los logs de Render.
 */
export const IDP_RATE_LIMITED_REASON = "idp_rate_limited";

// Ventana del IdP. Sin Retry-After, el mensaje habla de "unos minutos".
const IDP_WINDOW_MINUTES = 15;

/**
 * Segundos de espera según el header Retry-After del IdP (segundos o fecha
 * HTTP), o null si no vino o no se entiende.
 */
export function parseRetryAfter(headers, now = Date.now()) {
  const raw = headers?.get?.("retry-after");
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

function waitText(retryAfterSeconds) {
  if (retryAfterSeconds === null) return "en unos minutos";
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes <= 1) return "en un minuto";
  return `en ${minutes} minutos`;
}

/**
 * Respuesta 429 identificada como del LDAP.
 *
 * @param {object} args
 * @param {"/auth/login"|"/auth/refresh"} args.endpoint endpoint del IdP que respondió 429
 * @param {{ headers?: { get(name: string): string|null } }} args.idpResponse
 * @param {boolean} [args.sessionActive] solo en refresh: si el access token sigue vigente
 */
export function idpRateLimitedResponse({ endpoint, idpResponse, sessionActive }) {
  const retryAfterSeconds = parseRetryAfter(idpResponse?.headers);

  console.warn(
    `[ldap] 429 del Login Federado en ${endpoint}: se agotó el cupo por IP del IdP ` +
      `(30 intentos cada ${IDP_WINDOW_MINUTES} min, compartido por todo el personal). ` +
      `retryAfter=${retryAfterSeconds ?? "sin header"}`
  );

  const body = {
    error: "TooManyRequests",
    reason: IDP_RATE_LIMITED_REASON,
    source: "ldap",
    retryAfterSeconds,
    message:
      "El Login Federado (LDAP) está limitando los ingresos de esta app. " +
      `Probá de nuevo ${waitText(retryAfterSeconds)}.`,
  };
  if (sessionActive !== undefined) body.sessionActive = sessionActive;

  const headers = { "X-Rate-Limited-By": "ldap" };
  if (retryAfterSeconds !== null) headers["Retry-After"] = String(retryAfterSeconds);

  return NextResponse.json(body, { status: 429, headers });
}
