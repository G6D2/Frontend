"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "./MaterialIcon";

/**
 * Páginas de primer nivel del ciudadano: viven en el bottom nav / drawer, no
 * son subpáginas de nada, así que nunca deben mostrar flecha atrás aunque el
 * caller la pida por error.
 */
const TOP_LEVEL_PATHS = ["/inicio", "/reportar", "/mis-alertas", "/perfil"];

/**
 * Header único para todas las páginas del ciudadano (Inicio, Reportar, Mis
 * alertas, detalle de alerta, Perfil y sus subpáginas): título de la página
 * centrado y, solo cuando la página no es de primer nivel (no vive en el
 * bottom nav / drawer), una flecha atrás a la izquierda.
 *
 * La marca "CityPass+ Emergencia" vive únicamente en el drawer (Navbar) —
 * este header nunca la repite — y no tiene pin de geolocalización ni X de
 * cerrar: antes cada página mostraba una combinación distinta de esos
 * elementos (pin que no hacía nada, X redundante con la flecha atrás, etc.).
 */
export default function CitizenTopBar({ title, showBack = false, backHref = "/inicio" }) {
  const pathname = usePathname();
  const isTopLevel = TOP_LEVEL_PATHS.includes(pathname);
  const shouldShowBack = showBack && !isTopLevel;

  return (
    <header className="sticky top-0 z-40 flex items-center px-4 h-14 bg-surface border-b border-outline-variant pt-safe">
      <div className="flex items-center min-w-[40px]">
        {shouldShowBack && (
          <Link
            href={backHref}
            aria-label="Volver"
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="arrow_back" />
          </Link>
        )}
      </div>

      <h1 className="flex-1 text-base sm:text-xl font-bold text-primary truncate px-2 text-center">
        {title}
      </h1>

      <div className="min-w-[40px]" aria-hidden="true" />
    </header>
  );
}
