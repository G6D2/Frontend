"use client";

import Link from "next/link";
import MaterialIcon from "./civic/MaterialIcon";

/**
 * Header único para todas las páginas de /ops (Estados/Lista, Mapa,
 * Oficiales, Historial, Asignar oficial, Mi cuenta): mismo alto, borde
 * inferior y tipografía que `CitizenTopBar` (ver app/components/civic/
 * CitizenTopBar.js) para que ciudadano y dispatcher compartan un único
 * patrón visual de header. Título centrado y, solo en subpáginas
 * (hoy únicamente /ops/asignar/[id]), una flecha atrás a la izquierda.
 *
 * `right` es un slot opcional para un indicador chico (p. ej. "actualizado
 * hace Xs" en /ops/lista); si no se pasa, el espacio queda en blanco igual
 * que en CitizenTopBar para mantener el título perfectamente centrado.
 */
export default function PageHeader({
  title,
  showBack = false,
  backHref = "/ops/lista",
  right = null,
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center px-4 h-14 bg-surface border-b border-outline-variant pt-safe">
      <div className="flex items-center min-w-[40px]">
        {showBack && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
          >
            <MaterialIcon name="arrow_back" />
          </Link>
        )}
      </div>

      <h1 className="flex-1 text-base sm:text-xl font-bold text-primary truncate px-2 text-center">
        {title}
      </h1>

      {right ? (
        <div className="min-w-[40px] flex items-center justify-end">
          {right}
        </div>
      ) : (
        <div className="min-w-[40px]" aria-hidden="true" />
      )}
    </header>
  );
}
