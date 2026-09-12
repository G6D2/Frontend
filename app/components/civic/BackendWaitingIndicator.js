"use client";

import { useSyncExternalStore } from "react";
import { backendWaitingStore } from "../../lib/api";

/**
 * Aviso discreto (no modal) de que el backend en Render está despertando.
 * apiFetch (app/lib/api.js) marca backendWaitingStore como "esperando" recién
 * si una llamada supera 3 s sin responder, así que en un backend ya
 * despierto esto nunca llega a aparecer.
 */
export default function BackendWaitingIndicator() {
  const waiting = useSyncExternalStore(
    backendWaitingStore.subscribe,
    backendWaitingStore.getSnapshot,
    backendWaitingStore.getServerSnapshot
  );

  if (!waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[300] flex flex-col items-center pointer-events-none"
    >
      <div className="h-[3px] w-full overflow-hidden bg-primary/15">
        <div className="h-full w-full origin-left bg-primary animate-pulse" />
      </div>
      <span className="mt-1 rounded-full bg-surface/95 px-3 py-0.5 text-[11px] font-medium text-on-surface-variant shadow-sm">
        Conectando con el servidor…
      </span>
    </div>
  );
}
