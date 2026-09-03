"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchEmergencies,
  POLLING_INTERVAL_MS,
} from "../../lib/api";
import {
  PRIORITY_CONFIG,
  locationLabel,
  getStatusConfig,
} from "../../lib/emergencies";

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
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    const load = () => {
      fetchEmergencies()
        .then((data) => {
          setEmergencies(data);
          setError("");
        })
        .catch((err) => setError(err.message || "No se pudo cargar el mapa"));
    };

    load();
    const interval = setInterval(load, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

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
    <main className="p-3 sm:p-4 h-screen flex flex-col gap-3 sm:gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-primary">Mapa Operativo</h1>
        <button
          type="button"
          title="Mi ubicación"
          onClick={handleMyLocation}
          className="p-2 rounded border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          <MaterialIcon name="my_location" size={20} />
        </button>
      </div>

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
      </div>

      <div className="shrink-0 flex gap-4 overflow-x-auto pb-2">
        {emergencies.length === 0 && !error && (
          <p className="text-xs text-on-surface-variant py-2">
            No hay emergencias para mostrar en el mapa.
          </p>
        )}
        {emergencies.map((em) => {
          const priority = PRIORITY_CONFIG[em.severity || "critical"];
          const active = selectedId === em.id;
          return (
            <button
              key={em.id}
              type="button"
              onClick={() => {
                setFlyTo(null);
                setSelectedId(em.id);
              }}
              className={`shrink-0 w-48 p-3 text-left bg-surface-container-lowest border rounded transition-colors ${
                active
                  ? "border-secondary ring-1 ring-secondary"
                  : "border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: `var(--color-${priority.color})`,
                  }}
                />
                <div className="text-xs font-bold text-on-surface truncate">
                  {em.description}
                </div>
              </div>
              <div className="text-[10px] text-on-surface-variant">
                {locationLabel(em)} · {getStatusConfig(em.status).label}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
