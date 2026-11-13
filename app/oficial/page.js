"use client";

import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "../components/civic/MaterialIcon";
import GeoLabel from "../components/civic/GeoLabel";
import PageHeader from "../components/PageHeader";
import CitizenPageContainer from "../components/civic/CitizenPageContainer";
import {
  fetchOfficerEmergencies,
  advanceOfficerStatus,
  OFFICER_NEXT_STEP,
  CITIZEN_POLLING_INTERVAL_MS,
} from "../lib/api";
import {
  emergencyTitle,
  formatTime,
  getStatusConfig,
  PRIORITY_CONFIG,
  TYPE_LABELS,
} from "../lib/emergencies";

/**
 * MVP del oficial: lista de emergencias asignadas y un solo botón por
 * tarjeta con el próximo paso (En camino → Llegué al lugar → Resolver).
 * Resolver pide confirmación porque saca la emergencia de la lista.
 */
function AssignmentCard({ emergency, busy, onAdvance }) {
  const [confirming, setConfirming] = useState(false);
  const statusCfg = getStatusConfig(emergency.status);
  const priority = PRIORITY_CONFIG[emergency.severity];
  const step = OFFICER_NEXT_STEP[emergency.status];
  const typeLabel =
    TYPE_LABELS[emergency.emergencyType] ||
    TYPE_LABELS[String(emergency.emergencyType || "").toLowerCase()];

  const handleClick = () => {
    if (step.action === "resolve" && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onAdvance(emergency.id, step.action);
  };

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col gap-3 border border-outline-variant shadow-ambient-lvl2">
      <div className="flex justify-between items-start gap-3">
        <div className="flex flex-col min-w-0">
          <h2 className="text-lg font-semibold text-on-surface break-words">
            {emergencyTitle(emergency)}
          </h2>
          <span className="text-xs font-medium text-on-surface-variant">
            {typeLabel ? `${typeLabel} · ` : ""}
            {formatTime(emergency.createdAt)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusCfg.badgeClass}`}>
            {statusCfg.label}
          </span>
          {priority && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${priority.badgeClass}`}>
              {priority.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-surface-container-highest">
        <MaterialIcon name="location_on" className="text-primary" />
        <p className="text-base text-on-surface font-medium">
          <GeoLabel emergency={emergency} fallback="Obteniendo dirección…" />
        </p>
      </div>

      {step && (
        <div className="flex gap-2">
          {confirming && (
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 min-h-touch rounded-lg border border-outline-variant text-on-surface font-semibold text-sm py-3"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            className="flex-1 min-h-touch rounded-lg bg-primary text-on-primary font-semibold text-sm py-3 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <MaterialIcon name={step.icon} size={18} />
            {busy ? "Guardando…" : confirming ? "Confirmar resolución" : step.label}
          </button>
        </div>
      )}
    </article>
  );
}

export default function OficialPage() {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchOfficerEmergencies();
      setEmergencies(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "No se pudieron cargar tus asignaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, CITIZEN_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleAdvance = async (id, action) => {
    setBusyId(id);
    try {
      await advanceOfficerStatus(id, action);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* Header y contenedor compartidos con las demás vistas; el panel
          lateral y la navegación móvil vienen de app/oficial/layout.js. */}
      <PageHeader title="Mis asignaciones" />
      <CitizenPageContainer className="gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-error-container text-on-error-container p-3 text-sm">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-on-surface-variant">Cargando…</p>
        ) : emergencies.length === 0 ? (
          <p className="text-on-surface-variant">No tenés emergencias asignadas.</p>
        ) : (
          emergencies.map((e) => (
            <AssignmentCard
              key={e.id}
              emergency={e}
              busy={busyId === e.id}
              onAdvance={handleAdvance}
            />
          ))
        )}
      </CitizenPageContainer>
    </>
  );
}
