import { NextResponse } from "next/server";
import { readAccessToken, userFromJwt } from "@/lib/session";
import { isDispatcher } from "@/app/lib/auth-roles";
import { analyticsEmbedUrl } from "@/app/lib/analytics";

/**
 * GET /api/analytics → tablero de emergencias del backend de analítica.
 *
 * El iframe de /ops/analitica no puede mandar el Bearer (y el token está en la
 * cookie httpOnly), así que lo agrega este route. Se proxea solo esa URL fija.
 *
 * El backend de analítica NO valida roles (solo que la petición venga de
 * nuestra app con el módulo): el 403 de acá para quien no es dispatcher es el
 * único filtro, no sacarlo.
 *
 * El HTML se sirve desde nuestro origen, así que el iframe va con
 * sandbox="allow-scripts" y la respuesta con la directiva CSP `sandbox` (ver
 * next.config.mjs): su JS corre en un origen opaco y no puede usar la sesión
 * del dispatcher contra /api/backend.
 */

const TIMEOUT_MS = 30_000;

function json(status, error, message) {
  return NextResponse.json({ error, message }, { status });
}

async function proxy(request) {
  const token = await readAccessToken();
  if (!token) {
    return json(401, "Unauthorized", "Sesión expirada. Volvé a iniciar sesión.");
  }
  if (!isDispatcher(userFromJwt(token))) {
    return json(403, "Forbidden", "La analítica es solo para dispatchers");
  }

  let upstream;
  try {
    upstream = await fetch(analyticsEmbedUrl(), {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, Accept: "text/html" },
      cache: "no-store",
      // Un redirect podría mandar el Bearer a otro host: no se sigue.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return json(502, "Bad Gateway", "El servicio de analítica no responde. Probá de nuevo en unos segundos.");
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return json(502, "Bad Gateway", "El servicio de analítica respondió con un redirect inesperado");
  }

  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.set("Content-Type", upstream.headers.get("content-type") || "text/html; charset=utf-8");

  const body = request.method === "HEAD" ? null : upstream.body;
  return new NextResponse(body, { status: upstream.status, headers });
}

export const GET = proxy;
export const HEAD = proxy;
