"use client";

import MaterialIcon from "./MaterialIcon";

export default function SosConfirmationModal({ open, onClose, onConfirm, loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-on-background/40 transition-opacity"
        onClick={onClose}
        role="presentation"
      />
      <div className="bg-surface rounded-t-[28px] w-full max-w-[1280px] mx-auto relative z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="p-6 flex flex-col gap-6">
          <div className="w-8 h-1 bg-outline-variant rounded-full mx-auto" />
          <div className="text-center">
            <h2 className="text-2xl font-bold text-on-surface mb-2">
              ¿Necesitás ayuda de emergencia?
            </h2>
            <p className="text-base text-on-surface-variant">
              Se enviará tu ubicación actual a las autoridades pertinentes.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full bg-error text-on-error font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MaterialIcon name="emergency" filled />
              {loading ? "Enviando..." : "Sí, enviar alerta"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full bg-surface text-primary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-outline hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
