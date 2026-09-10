"use client";

import { useState } from "react";

/**
 * Modal simple (sin Mantine) para pedir motivo de descarte.
 * Usable desde lista Tailwind y desde el kanban.
 */
export default function DiscardReasonModal({
  open,
  title = "Descartar emergencia",
  confirmLabel = "Descartar",
  busy = false,
  onClose,
  onConfirm,
}) {
  // Desmontar el formulario al cerrar resetea el motivo sin useEffect/setState.
  if (!open) return null;

  return (
    <DiscardReasonForm
      title={title}
      confirmLabel={confirmLabel}
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function DiscardReasonForm({ title, confirmLabel, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-reason-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-surface border border-outline-variant shadow-xl p-4 flex flex-col gap-3">
        <h2
          id="discard-reason-title"
          className="text-base font-bold text-on-surface"
        >
          {title}
        </h2>
        <p className="text-sm text-on-surface-variant">
          Indicá el motivo del descarte (obligatorio).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={busy}
          placeholder="Ej. falsa alarma, duplicado…"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-outline-variant text-on-surface disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !trimmed}
            onClick={() => onConfirm?.(trimmed)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-primary text-on-primary disabled:opacity-50"
          >
            {busy ? "Descartando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
