import { NextResponse } from "next/server";
import { log429, markLogged } from "@/lib/log-429";

/**
 * 403/429 que no son del backend: los corta algo entre este servidor (BFF) y
 * la app del backend en Render, típicamente Cloudflare (Render publica los
 * servicios detrás de Cloudflare).
 *
 * Cómo se distingue de un error del backend: el backend siempre responde sus
 * errores en JSON (`{ error, message }`, incluido su propio rate limit). Un
 * 403/429 sin JSON no salió de nuestro código.
 *
 * Cómo se reconoce a Cloudflare: el header `cf-mitigated` (lo pone cuando
 * desafía o bloquea) o la página de desafío ("Just a moment...") en el cuerpo.
 * El header `server: cloudflare` NO alcanza: lo traen todas las respuestas de
 * onrender.com, también los 200.
 */
export const EDGE_BLOCKED_REASON = "edge_blocked";

const BLOCK_STATUSES = new Set([403, 429]);
const CHALLENGE_MARKERS = /just a moment|cf-chl|challenge-platform|attention required|cloudflare ray id/i;

function header(res, name) {
  return res?.headers?.get?.(name) || null;
}

/**
 * @param {{ status: number, headers?: { get(name: string): string|null } }} res
 * @param {string} [bodyText] cuerpo ya leído (para buscar la página de desafío)
 * @returns {null | { source: "cloudflare"|"edge", status: number, cfMitigated: string|null, cfRay: string|null, server: string|null }}
 */
export function detectEdgeBlock(res, bodyText = "") {
  const cfMitigated = header(res, "cf-mitigated");
  const contentType = (header(res, "content-type") || "").toLowerCase();
  const isJson = contentType.includes("json");
  const challengePage = !isJson && CHALLENGE_MARKERS.test(String(bodyText).slice(0, 5000));

  const blocked = cfMitigated || (BLOCK_STATUSES.has(res.status) && !isJson);
  if (!blocked) return null;

  return {
    source: cfMitigated || challengePage ? "cloudflare" : "edge",
    status: res.status,
    cfMitigated,
    cfRay: header(res, "cf-ray"),
    server: header(res, "server"),
    contentType: header(res, "content-type"),
  };
}

/**
 * Respuesta identificada para el browser, con el mismo status. Deja en el log
 * de Render una línea "[429][cloudflare] ..." (o "[403][...]", "[429][edge]")
 * con el cf-ray, que es lo que pide el soporte de Render/Cloudflare para
 * buscar el bloqueo (ver lib/log-429.js).
 *
 * @param {ReturnType<typeof detectEdgeBlock>} block
 * @param {{ method: string, path: string, bodyText?: string, retryAfter?: string|null }} context
 */
export function edgeBlockedResponse(block, { method, path, bodyText = "", retryAfter = null }) {
  log429({
    source: block.source,
    method,
    route: path,
    res: { status: block.status, headers: { get: (name) => ({
      "cf-ray": block.cfRay,
      "cf-mitigated": block.cfMitigated,
      server: block.server,
      "content-type": block.contentType,
      "retry-after": retryAfter,
    })[name] ?? null } },
    bodyText,
    note: "cortado antes de llegar al backend",
  });

  const who =
    block.source === "cloudflare"
      ? "Cloudflare bloqueó el pedido al backend"
      : "Un intermediario bloqueó el pedido antes de llegar al backend";

  const headers = { "X-Blocked-By": block.source };
  if (retryAfter) headers["Retry-After"] = retryAfter;

  return markLogged(NextResponse.json(
    {
      error: block.status === 429 ? "TooManyRequests" : "Forbidden",
      reason: EDGE_BLOCKED_REASON,
      source: block.source,
      cfRay: block.cfRay,
      message: `${who}: HTTP ${block.status}${block.cfRay ? `, cf-ray ${block.cfRay}` : ""}`,
    },
    { status: block.status, headers }
  ));
}
