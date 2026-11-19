import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";
import { log429, bodySnippet } from "@/lib/log-429";

/**
 * POST /api/telemetry/429 → { events: [...] }
 *
 * 429 que el navegador recibió de nuestro propio origen sin la marca
 * X-429-Logged: los cortó algo antes de este servidor (ver
 * app/lib/report-429.js). Cada evento queda como una línea "[429][browser]"
 * en el log de Render, con la hora en que pasó en el navegador.
 *
 * Público (un 429 puede pasar antes de iniciar sesión), pero solo JSON del
 * mismo origen, hasta 20 eventos por pedido y cada campo recortado: no es un
 * canal para escribir cualquier cosa en el log.
 */
const MAX_EVENTS = 20;
const MAX_BYTES = 32 * 1024;

function field(value, max = 120) {
  if (value === null || value === undefined) return "-";
  return bodySnippet(String(value), max).replace(/\s/g, "_") || "-";
}

export async function POST(request) {
  const rejected = checkCsrf(request);
  if (rejected) return rejected;

  const raw = await request.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
  }

  let events;
  try {
    events = JSON.parse(raw)?.events;
  } catch {
    events = null;
  }
  if (!Array.isArray(events)) {
    return NextResponse.json(
      { error: "Bad Request", message: "Se espera { events: [...] }" },
      { status: 400 }
    );
  }

  for (const event of events.slice(0, MAX_EVENTS)) {
    if (!event || typeof event !== "object") continue;
    const status = Number(event.status);
    const headers = {
      "cf-ray": event.cfRay,
      "cf-mitigated": event.cfMitigated,
      "retry-after": event.retryAfter,
      server: event.server,
      "content-type": event.contentType,
    };
    log429({
      source: "browser",
      method: field(event.method, 10),
      route: field(event.path, 200),
      status: Number.isInteger(status) ? status : 429,
      res: { headers: { get: (name) => (headers[name] ? field(headers[name]) : null) } },
      bodyText: typeof event.body === "string" ? event.body : "",
      note: `visto en el navegador a las ${field(event.at, 40)} en ${field(event.page, 120)}`,
    });
  }

  return new NextResponse(null, { status: 204 });
}
