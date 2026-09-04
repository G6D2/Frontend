"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MaterialIcon from "../../../components/civic/MaterialIcon";
import {
  fetchEmergencyById,
  getStoredUser,
  fetchCurrentUser,
} from "../../../lib/api";
import { isDispatcher } from "../../../lib/auth";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  locationLabel,
} from "../../../lib/emergencies";

const OFFICERS = [
  // TODO(back): reemplazar por fetchOfficers() (HU-06) — cercanía y disponibilidad reales
  { id: "u-14", name: "Unidad 14", status: "disponible", distance: "1.2 km", eta: "4 min" },
  { id: "u-07", name: "Unidad 07", status: "disponible", distance: "2.8 km", eta: "8 min" },
  { id: "u-22", name: "Unidad 22", status: "ocupado", distance: "—", eta: "—" },
  { id: "u-03", name: "Unidad 03", status: "disponible", distance: "3.1 km", eta: "9 min" },
];

export default function AsignarOficialPage() {
  const params = useParams();
  const router = useRouter();
  const [emergency, setEmergency] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) {
          router.replace("/inicio");
          return;
        }
        const data = await fetchEmergencyById(params.id);
        if (!cancelled) setEmergency(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const priority = PRIORITY_CONFIG[emergency?.severity || "critical"];

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors"
      >
        <MaterialIcon name="arrow_back" />
        <span className="text-[11px] font-bold uppercase tracking-widest">
          Volver
        </span>
      </button>

      {error && (
        <div className="p-3 mb-4 rounded bg-error-container text-on-error-container text-sm">
          {error}
        </div>
      )}

      {emergency && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-on-surface">
              Asignar Oficial
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-${priority.color}) 20%, transparent)`,
                color: `var(--color-${priority.color})`,
              }}
            >
              {priority.label}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            #{emergency.id.slice(0, 8)} · {getStatusConfig(emergency.status).label} ·{" "}
            {locationLabel(emergency)}
          </p>
          <p className="text-xs text-on-surface-variant mt-2 italic">
            &quot;{emergency.description}&quot;
          </p>
          <p className="text-[11px] text-on-surface-variant/70 mt-3">
            {/* TODO(back): HU-06 assignOfficer(emergencyId, officerId) → DESPATCHED + notificar oficial */}
            {/* TODO(back): si no hay oficiales, cola de espera + alerta al dispatcher */}
            La asignación aún no está implementada en el backend (HU-06).
          </p>
        </div>
      )}

      <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        Oficiales disponibles (mock UI)
      </h2>

      <div className="flex flex-col gap-2">
        {OFFICERS.map((officer) => (
          <div
            key={officer.id}
            className={`flex items-center justify-between p-4 border rounded transition-colors ${
              officer.status === "disponible"
                ? "border-outline-variant bg-surface-container-lowest"
                : "border-outline-variant/50 bg-surface-container opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
                {officer.id.split("-")[1]}
              </div>
              <div>
                <div className="text-sm font-bold text-on-surface">
                  {officer.name}
                </div>
                <div className="text-xs text-on-surface-variant">
                  {officer.distance} · ETA {officer.eta}
                </div>
              </div>
            </div>
            <button
              disabled
              // TODO(back): onClick → assignOfficer(emergency.id, officer.id)
              className="h-8 px-4 bg-primary/40 text-on-primary rounded text-[11px] font-bold uppercase tracking-widest cursor-not-allowed"
            >
              Próximamente
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
