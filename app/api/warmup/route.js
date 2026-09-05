import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/session";

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
    return NextResponse.json({ warmed: true, status: res.status });
  } catch {
    return NextResponse.json({ warmed: false, reason: "unreachable" });
  }
}
