import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/session";
import { detectEdgeBlock } from "@/lib/edge-block";
import { log429 } from "@/lib/log-429";

export const dynamic = "force-dynamic";

/** Corta el ping si el backend no responde; no queremos colgar la request. */
const WARMUP_TIMEOUT_MS = 20_000;

/**
 * Despierta al backend cuando está dormido (plan free de Render, que suspende
 * el servicio por inactividad). No autentica ni le importa la respuesta: con
 * que el servicio empiece a levantar alcanza, así el primer login del usuario
 * no se come el arranque en frío.
 *
 * Se desactiva con BACKEND_WARMUP=off, para cuando el backend sea always-on.
 */
export async function GET() {
  if (process.env.BACKEND_WARMUP === "off") {
    return NextResponse.json({ warmed: false, reason: "disabled" });
  }

  const path = process.env.BACKEND_WARMUP_PATH || "/";
  const target = `${BACKEND_URL}${path}`;

  try {
    // Cualquier status sirve: un 404 también prueba que el backend está vivo.
    const res = await fetch(target, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS),
    });
    // Un 429 o un bloqueo acá es el mismo tramo BFF → backend que usa el
    // tablero: se registra aunque el warmup no lo muestre a nadie.
    const block = detectEdgeBlock(res);
    if (res.status === 429 || block) {
      log429({
        source: block?.source || "backend",
        method: "GET",
        route: path,
        res,
        bodyText: await res.text().catch(() => ""),
        note: "warmup",
      });
    }
    return NextResponse.json({ warmed: true, status: res.status });
  } catch {
    return NextResponse.json({ warmed: false, reason: "unreachable" });
  }
}
