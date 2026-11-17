"use client";

import { useEffect, useRef, useState } from "react";
import MaterialIcon from "../civic/MaterialIcon";
import {
  ALERTAS_CLIMA_POLLING_INTERVAL_MS,
  fetchAlertasClimaticasActivas,
} from "../../lib/api";
import { formatAlertaClimatica } from "../../lib/clima";
import { createPoller } from "../../lib/polling";

/**
 * Banner del tablero del dispatcher con las alertas climáticas ALTA y
 * CRITICA activas (o por empezar), una línea por alerta: dónde suben un
 * nivel las prioridades y hasta cuándo. Aparece haya o no emergencias
 * abiertas. Solo lee: el aviso al resto de la ciudad lo publica Espacios
 * (ADR "Responder a las alertas climáticas de Espacios"). Sin alertas no
 * renderiza nada.
 *
 * Un error (backend dormido, endpoint todavía no desplegado) no se muestra:
 * se conserva lo último que se cargó y el poller reintenta en 60 s.
 *
 * Publica su alto en la variable CSS --ops-banner-h para que las vistas de
 * alto fijo (/ops/mapa usa h-screen) no queden con scroll.
 */
export default function AlertaClimaticaBanner() {
  const [alertas, setAlertas] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const poller = createPoller({
      load: async () => {
        try {
          setAlertas(await fetchAlertasClimaticasActivas());
        } catch {
          // Silencioso a propósito: ver comentario del componente.
        }
      },
      intervalMs: ALERTAS_CLIMA_POLLING_INTERVAL_MS,
    });
    poller.start();
    return () => poller.stop();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") {
      root.style.removeProperty("--ops-banner-h");
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty("--ops-banner-h", `${entry.target.offsetHeight}px`);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--ops-banner-h");
    };
  }, [alertas.length]);

  if (alertas.length === 0) return null;

  const now = new Date();
  return (
    <section
      ref={ref}
      role="status"
      aria-live="polite"
      aria-label="Alertas climáticas activas"
      className="sticky top-0 z-[200] border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950"
    >
      <ul className="flex flex-col gap-1">
        {alertas.map((alerta) => (
          <li
            key={alerta.id}
            title={alerta.descripcion ?? undefined}
            className="flex items-start gap-2 text-xs font-bold"
          >
            <MaterialIcon
              name="warning"
              size={16}
              className={alerta.enCurso ? "text-amber-700" : "text-amber-500"}
            />
            <span>{formatAlertaClimatica(alerta, { now })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
