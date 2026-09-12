"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MaterialIcon from "./MaterialIcon";

/**
 * Confirmación antes de cancelar la asistencia solicitada (ver SosConfirmationModal
 * para el mismo lenguaje visual: bottom sheet en mobile, modal centrado en
 * desktop). El motivo es opcional: cancelar no debería trabarse por eso.
 */
export default function ConfirmCancelModal({ open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-on-background/50"
        onClick={loading ? undefined : onClose}
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-title"
        className="bg-surface rounded-t-[28px] sm:rounded-3xl w-full max-w-lg relative z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-5 pb-8">
          <div className="w-8 h-1 bg-outline-variant rounded-full mx-auto sm:hidden" />
          <div className="text-center">
            <h2
              id="confirm-cancel-title"
              className="text-2xl font-bold text-on-surface mb-2"
            >
              ¿Cancelar la asistencia?
            </h2>
            <p className="text-base text-on-surface-variant">
              Vamos a avisar a las autoridades que ya no necesitás ayuda.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label
              htmlFor="cancel-reason"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Motivo (opcional)
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={280}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={loading}
              placeholder="Ej: ya me ayudaron, fue una falsa alarma..."
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary outline-none resize-none"
            />
            <span className="text-xs text-on-surface-variant text-right">
              {reason.length}/280
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onConfirm(reason.trim() || undefined)}
              disabled={loading}
              className="w-full bg-secondary text-on-secondary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] shadow-sm cursor-pointer hover:opacity-90 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <MaterialIcon name="cancel" filled />
              {loading ? "Cancelando…" : "Sí, cancelar asistencia"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full bg-surface text-primary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-outline cursor-pointer hover:bg-surface-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
