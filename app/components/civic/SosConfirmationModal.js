"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MaterialIcon from "./MaterialIcon";

export default function SosConfirmationModal({
  open,
  onClose,
  onConfirm,
  loading,
}) {
  const [description, setDescription] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDescription("");
      return undefined;
    }
    document.body.dataset.sosOpen = "1";
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      delete document.body.dataset.sosOpen;
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
        aria-labelledby="sos-modal-title"
        className="bg-surface rounded-t-[28px] sm:rounded-3xl w-full max-w-lg relative z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-5 pb-8">
          <div className="w-8 h-1 bg-outline-variant rounded-full mx-auto sm:hidden" />
          <div className="text-center">
            <h2
              id="sos-modal-title"
              className="text-2xl font-bold text-on-surface mb-2"
            >
              ¿Necesitás ayuda de emergencia?
            </h2>
            <p className="text-base text-on-surface-variant">
              Se enviará tu ubicación actual a las autoridades pertinentes.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label
              htmlFor="sos-description"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="sos-description"
              rows={3}
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={loading}
              placeholder="Ej: Estoy en el estacionamiento del edificio..."
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary outline-none resize-none"
            />
            <span className="text-xs text-on-surface-variant text-right">
              {description.length}/280
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onConfirm(description.trim())}
              disabled={loading}
              className="w-full bg-error text-on-error font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MaterialIcon name="emergency" filled />
              {loading ? "Enviando..." : "Sí, enviar alerta"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full bg-surface text-primary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-outline hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
