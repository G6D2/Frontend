/**
 * Defensa CSRF para los endpoints mutantes del BFF (POST/PUT/PATCH/DELETE).
 *
 * La cookie de sesión es SameSite=Lax, así que otro sitio no puede mandarla
 * en un POST. Pero el login y el registro no necesitan cookie para hacer
 * daño: un form o un fetch `text/plain` desde otro origen (una "simple
 * request", que no dispara preflight CORS) llegaba a `request.json()` y
 * dejaba a la víctima logueada con la cuenta del atacante (login CSRF).
 *
 * Cada request mutante pasa por dos chequeos:
 *
 * 1. Origen (403). Si viene `Origin`, su host tiene que coincidir con el de
 *    la request: `X-Forwarded-Host` si lo pone un proxy, si no `Host`. Es el
 *    mismo criterio que usa Next para las Server Actions. Se compara solo el
 *    host (no el esquema) porque detrás del proxy de Render la app recibe
 *    http aunque el navegador hable https.
 *    Si NO viene `Origin`, se deja pasar salvo que `Sec-Fetch-Site` diga que
 *    es de otro sitio. Los navegadores actuales mandan `Origin` en todo POST,
 *    también en los same-origin, así que una request sin `Origin` no sale de
 *    un navegador con la cookie de la víctima: son curl, los tests o clientes
 *    server-side, que no son vector de CSRF. `Origin: null` (iframe con
 *    sandbox, redirects entre orígenes) se rechaza.
 * 2. Content-Type (415). Tiene que ser `application/json`. Un form HTML no
 *    puede mandarlo, y un fetch desde otro origen que lo mande dispara un
 *    preflight CORS que el BFF no responde. Se omite con `{ json: false }`
 *    para los endpoints sin body (logout, refresh, DELETE del proxy).
 */
import { NextResponse } from "next/server";

function requestHost(request) {
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("host");
}

function originHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return null; // "null" u otro valor que no es un origen válido
  }
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin === null) {
    const site = request.headers.get("sec-fetch-site");
    return site !== "cross-site" && site !== "same-site";
  }
  const host = requestHost(request);
  return Boolean(host) && originHost(origin) === host;
}

export function isJsonRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * Devuelve la respuesta de error si la request no pasa los chequeos, o null
 * si puede seguir. Uso: `const rejected = checkCsrf(request); if (rejected) return rejected;`
 */
export function checkCsrf(request, { json = true } = {}) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Forbidden", message: "Origen no permitido" },
      { status: 403 }
    );
  }
  if (json && !isJsonRequest(request)) {
    return NextResponse.json(
      { error: "Unsupported Media Type", message: "Se espera Content-Type: application/json" },
      { status: 415 }
    );
  }
  return null;
}
