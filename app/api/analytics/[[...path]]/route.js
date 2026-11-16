import { NextResponse } from "next/server";
import { readAccessToken, userFromJwt } from "@/lib/session";
import { isDispatcher } from "@/app/lib/auth-roles";
import {
  ANALYTICS_EMBED_URL,
  ANALYTICS_PROXY_PREFIX,
  analyticsOrigin,
  rewriteAnalyticsUrls,
} from "@/app/lib/analytics";

/**
 * GET /api/analytics/<path> → <backend de analítica>/<path>
 *
 * Proxy del módulo de analítica (/ops/analitica). El embed exige
 * `Authorization: Bearer <access_token del IdP>`; un iframe no puede mandar
 * headers y el token está en la cookie httpOnly, así que lo agrega este route.
 *
 * - Solo dispatchers (el backend de analítica sigue siendo la autoridad).
 * - Solo GET/HEAD: el embed es de lectura; así no hace falta chequeo CSRF.
 * - Cubre todo el host (no solo /embed/) para que los assets y datos que pida
 *   el HTML también pasen con el Bearer. Las URLs que el HTML/CSS/JS apuntan al
 *   host o a paths absolutos se reescriben a /api/analytics (ver
 *   rewriteAnalyticsUrls).
 * - No reenvía cookies nuestras ni Set-Cookie del backend de analítica.
 */

const ORIGIN = analyticsOrigin(ANALYTICS_EMBED_URL);
const EMBED_PATH = ORIGIN ? new URL(ANALYTICS_EMBED_URL).pathname : "/";
const TIMEOUT_MS = 20_000;

/** Igual que en /api/backend: sin "." / ".." ni restos de encoding. */
const SAFE_SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

/** Tipos de texto donde puede haber URLs para reescribir. */
const REWRITABLE = /^(text\/html|text\/css|text\/javascript|application\/javascript|application\/json)/i;

/** Headers de la respuesta del backend de analítica que se reenvían tal cual. */
const PASSTHROUGH_HEADERS = ["content-type", "content-disposition", "last-modified", "etag"];

/** Directorio de un path: "/embed/" → "/embed/", "/a/b.html" → "/a/". */
function baseDir(path) {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

/** Agrega <base href> al <head> si el documento no trae uno propio. */
function injectBase(html, href) {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${href}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  return `${tag}${html}`;
}

function json(status, error, message, headers) {
  return NextResponse.json({ error, message }, { status, headers });
}

async function proxy(request, context) {
  if (!ORIGIN) {
    return json(500, "Misconfigured", "URL de analítica inválida");
  }

  const { path = [] } = await context.params;
  const segments = Array.isArray(path) ? path : [path];
  if (!segments.every((s) => SAFE_SEGMENT.test(s))) {
    return json(400, "Bad Request", "Ruta inválida");
  }

  const token = await readAccessToken();
  if (!token) {
    return json(401, "Unauthorized", "Sesión expirada. Volvé a iniciar sesión.");
  }
  if (!isDispatcher(userFromJwt(token))) {
    return json(403, "Forbidden", "La analítica es solo para dispatchers");
  }

  const url = new URL(request.url);
  // Next saca la barra final (/api/analytics/embed/ → /embed) con un 308, pero
  // al backend de analítica puede importarle: si el path es el del embed
  // configurado (p. ej. "/embed/"), se le pide tal cual.
  let upstreamPath = `/${segments.join("/")}`;
  if (`${upstreamPath}/` === EMBED_PATH) upstreamPath = EMBED_PATH;
  const target = `${ORIGIN}${upstreamPath}${url.search}`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: request.headers.get("accept") || "*/*",
      },
      cache: "no-store",
      // Sin seguir redirects solo: no queremos mandar el Bearer a otro host.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return json(502, "Bad Gateway", "El servicio de analítica no responde. Probá de nuevo en unos segundos.");
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    let next = null;
    try {
      const resolved = new URL(location, target);
      if (resolved.origin === ORIGIN) {
        next = `${ANALYTICS_PROXY_PREFIX}${resolved.pathname}${resolved.search}`;
      }
    } catch {
      // location inválido
    }
    if (!next) {
      return json(502, "Bad Gateway", "El servicio de analítica redirigió fuera de su dominio");
    }
    return new NextResponse(null, { status: upstream.status, headers: { Location: next } });
  }

  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (request.method === "HEAD") {
    return new NextResponse(null, { status: upstream.status, headers });
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (REWRITABLE.test(contentType)) {
    const text = await upstream.text();
    const html = /^text\/html/i.test(contentType);
    let body = rewriteAnalyticsUrls(text, { origin: ORIGIN, html });
    // Como el browser ve /api/analytics/embed (sin barra), las URLs relativas
    // del HTML resolverían un nivel más arriba: el <base> las ancla al
    // directorio real del documento en el backend de analítica.
    if (html) body = injectBase(body, `${ANALYTICS_PROXY_PREFIX}${baseDir(upstreamPath)}`);
    return new NextResponse(body, { status: upstream.status, headers });
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const HEAD = proxy;
