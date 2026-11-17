"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import MaterialIcon from "../../components/civic/MaterialIcon";
import GeoLabel from "../../components/civic/GeoLabel";
import {
  fetchOpsEmergencies,
  isOpsStatus,
  POLLING_INTERVAL_MS,
} from "../../lib/api";
import { createPoller } from "../../lib/polling";
import {
  priorityDotClass,
  getStatusConfig,
  getEffectivePriority,
} from "../../lib/emergencies";
import PageHeader from "../../components/PageHeader";
import { IncidentBadge, ZoneContextBadge } from "../../components/ops/IncidentInfo";

const OpsMap = dynamic(() => import("../../components/ops/OpsMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm bg-surface-dim">
      Cargando mapa…
    </div>
  ),
});

export default function MapaOperativoPage() {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [flyTo, setFlyTo] = useState(null);

  // Solo las abiertas: fetchOpsEmergencies() ya filtra en el backend, y el
  // filtro local cubre cualquier respuesta que no lo respete.
  const load = useCallback(async () => {
    try {
      const data = await fetchOpsEmergencies();
      setEmergencies(data.filter((em) => isOpsStatus(em.status)));
      setError("");
    } catch (err) {
      setError(err.message || "No se pudo cargar el mapa");
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling con pausa en pestaña oculta y sin pedidos superpuestos (las
  // respuestas llegan en orden, no hace falta descartar las viejas).
  useEffect(() => {
    const poller = createPoller({ load, intervalMs: POLLING_INTERVAL_MS });
    poller.start();
    return () => poller.stop();
  }, [load]);

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedId(null);
        setFlyTo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zoom: 15,
        });
      },
      () => {
        setFlyTo({ lat: -34.6037, lng: -58.3816, zoom: 13 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    // Descuenta el banner de alertas climáticas (--ops-banner-h, 0 sin alertas).
    <div className="h-[calc(100vh_-_var(--ops-banner-h,0px))] flex flex-col">
      <PageHeader title="Mapa" />
      <main className="p-3 sm:p-4 flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">
        {error && (
          <div className="shrink-0 p-3 rounded bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 relative rounded border border-outline-variant overflow-hidden bg-surface-dim min-h-[280px]">
          <OpsMap
            emergencies={emergencies}
            selectedId={selectedId}
            flyTo={flyTo}
            onSelect={(em) => {
              setFlyTo(null);
              setSelectedId(em.id);
            }}
          />

          {/* Control flotante dentro del mapa (antes era un botón suelto
              arriba, fuera del mapa): mismo lugar/estilo que un control de
              Leaflet — blanco, sombra, esquina inferior derecha, por encima
              de los tiles y de los controles de zoom nativos (z-index
              mayor al de los panes de Leaflet). */}
          <button
            type="button"
            title="Mi ubicación"
            aria-label="Mi ubicación"
            onClick={handleMyLocation}
            className="absolute bottom-3 right-3 z-[1000] w-10 h-10 flex items-center justify-center rounded-lg bg-white text-on-surface shadow-md border border-outline-variant/60 hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <MaterialIcon name="my_location" size={20} />
          </button>
        </div>

        <div className="shrink-0 flex gap-4 overflow-x-auto pb-2">
          {loading && (
            <p role="status" className="text-xs text-on-surface-variant py-2">
              Cargando emergencias…
            </p>
          )}
          {!loading && emergencies.length === 0 && !error && (
            <p className="text-xs text-on-surface-variant py-2">
              No hay emergencias para mostrar en el mapa.
            </p>
          )}
          {emergencies.map((em) => {
            const active = selectedId === em.id;
            return (
              <button
                key={em.id}
                type="button"
                onClick={() => {
                  setFlyTo(null);
                  setSelectedId(em.id);
                }}
                className={`shrink-0 w-48 p-3 text-left bg-surface-container-lowest border rounded transition-colors cursor-pointer ${
                  active
                    ? "border-secondary ring-1 ring-secondary"
                    : "border-outline-variant hover:bg-surface-container-low"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityDotClass(getEffectivePriority(em))}`}
                  />
                  <div className="text-xs font-bold text-on-surface truncate">
                    {em.description}
                  </div>
                </div>
                <div className="text-[10px] text-on-surface-variant truncate mb-1">
                  <GeoLabel emergency={em} fallback="Obteniendo dirección…" /> ·{" "}
                  {getStatusConfig(em.status).label}
                </div>
                <IncidentBadge emergency={em} />
                <ZoneContextBadge emergency={em} />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
