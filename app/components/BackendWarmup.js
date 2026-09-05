"use client";

import { useEffect } from "react";

let pinged = false;

/**
 * Pega un ping a /api/warmup apenas carga la app para que el backend empiece
 * a levantar mientras el usuario todavía está mirando la pantalla de acceso.
 * Es fire-and-forget: si falla, no pasa nada.
 */
export default function BackendWarmup() {
  useEffect(() => {
    if (pinged) return;
    pinged = true;
    fetch("/api/warmup", { cache: "no-store" }).catch(() => {});
  }, []);

  return null;
}
