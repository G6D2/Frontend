"use client";

/**
 * Bottom sheet (mobile/tablet, con overlay) + panel lateral fijo (desktop,
 * sin overlay) para el detalle de una emergencia seleccionada.
 *
 * Extraído de /ops/lista (antes era JSX inline duplicado en cada breakpoint)
 * para que /ops/historial lo reutilice sin volver a escribir el overlay ni
 * el posicionamiento — mismas clases/estructura que ya tenía /ops/lista, sin
 * cambios de comportamiento. El contenido (header + body, con o sin acciones)
 * se sigue pasando por `children` porque difiere bastante entre una lista
 * activa (validar/descartar/asignar) y el historial (motivo, oficial, hora
 * de cierre, sin acciones).
 */
export default function EmergencyDetailPanel({ open, onClose, children }) {
  if (!open) return null;

  return (
    <>
      {/* Mobile / tablet: bottom sheet modal con overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center lg:hidden"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-surface-container-lowest border border-outline-variant rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {children}
        </div>
      </div>

      {/* Desktop: panel lateral derecho de 360px, dentro del layout, sin overlay */}
      <div className="hidden lg:flex lg:w-[360px] lg:shrink-0 lg:self-stretch bg-surface-container-lowest border border-outline-variant rounded-lg flex-col shadow-sm overflow-hidden">
        {children}
      </div>
    </>
  );
}
