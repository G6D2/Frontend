"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { createPoller } from "../lib/polling";

const RESOLUTION_CAUSES = [
  { value: "VIA", label: "Vía" },
  { value: "ESPACIO_PUBLICO", label: "Espacio público" },
  { value: "RESIDUOS", label: "Residuos" },
];

/**
 * MVP del oficial: lista de emergencias asignadas y un solo botón por
 * tarjeta con el próximo paso (En camino → Llegué al lugar → Resolver).
 * Al resolver, permite registrar causas relacionadas y su descripción.
 */
function AssignmentCard({ emergency, busy, onAdvance }) {
  const [resolving, setResolving] = useState(false);
  const [relatedCauses, setRelatedCauses] = useState([]);
  const [problemDescription, setProblemDescription] = useState("");
  const statusCfg = getStatusConfig(emergency.status);
  const priority = PRIORITY_CONFIG[emergency.severity];
  const step = OFFICER_NEXT_STEP[emergency.status];
  const hasViaCause = relatedCauses.includes("VIA");
  const typeLabel =
    TYPE_LABELS[emergency.emergencyType] ||
    TYPE_LABELS[String(emergency.emergencyType || "").toLowerCase()];

  const handleClick = () => {
    if (step.action === "resolve") {
      setResolving(true);
      return;
    }
    onAdvance(emergency.id, step.action);
  };

  const handleCauseChange = (cause, checked) => {
    setRelatedCauses((current) =>
      checked ? [...current, cause] : current.filter((value) => value !== cause)
    );
    if (cause === "VIA" && !checked) setProblemDescription("");
  };

  const handleCancelResolution = () => {
    setResolving(false);
    setRelatedCauses([]);
    setProblemDescription("");
  };

  const handleResolveSubmit = async (event) => {
    event.preventDefault();
    const description = problemDescription.trim();
    if (hasViaCause && !description) return;

    const resolution = { causasRelacionadas: relatedCauses };
    if (hasViaCause) resolution.descripcionProblema = description;

    if (await onAdvance(emergency.id, step.action, resolution)) {
      handleCancelResolution();
    }
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
        resolving && step.action === "resolve" ? (
          <form onSubmit={handleResolveSubmit} className="flex flex-col gap-4 border-t border-outline-variant pt-4">
            <fieldset disabled={busy} className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-on-surface">
                Causas relacionadas <span className="font-normal text-on-surface-variant">(opcional)</span>
              </legend>
              {RESOLUTION_CAUSES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={relatedCauses.includes(value)}
                    onChange={(event) => handleCauseChange(value, event.target.checked)}
                    className="size-5 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {hasViaCause && (
              <div className="flex flex-col gap-2">
                <label htmlFor={`problem-description-${emergency.id}`} className="text-sm font-semibold text-on-surface">
                  Descripción del problema <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id={`problem-description-${emergency.id}`}
                  rows={3}
                  maxLength={280}
                  required
                  value={problemDescription}
                  onChange={(event) => setProblemDescription(event.target.value)}
                  disabled={busy}
                  placeholder="Describí brevemente el problema observado"
                  className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary outline-none resize-none"
                />
                <span className="text-xs text-on-surface-variant text-right">
                  {problemDescription.length}/280
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelResolution}
                disabled={busy}
                className="flex-1 min-h-touch rounded-lg border border-outline-variant text-on-surface font-semibold text-sm py-3"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || (hasViaCause && !problemDescription.trim())}
                className="flex-1 min-h-touch rounded-lg bg-primary text-on-primary font-semibold text-sm py-3 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <MaterialIcon name="task_alt" size={18} />
                {busy ? "Guardando…" : "Confirmar resolución"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            className="w-full min-h-touch rounded-lg bg-primary text-on-primary font-semibold text-sm py-3 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <MaterialIcon name={step.icon} size={18} />
            {busy ? "Guardando…" : step.label}
          </button>
        )
      )}
    </article>
  );
}

export default function OficialPage() {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const pollerRef = useRef(null);

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

  // Polling con pausa en pestaña oculta y sin pedidos superpuestos (createPoller).
  useEffect(() => {
    const poller = createPoller({ load, intervalMs: CITIZEN_POLLING_INTERVAL_MS });
    pollerRef.current = poller;
    poller.start();
    return () => {
      poller.stop();
      pollerRef.current = null;
    };
  }, [load]);

  const handleAdvance = async (id, action, resolution) => {
    setBusyId(id);
    try {
      await advanceOfficerStatus(id, action, resolution);
      // refresh() espera un pedido en vuelo y vuelve a pedir: esa respuesta
      // pudo armarse antes del cambio de estado.
      await (pollerRef.current ? pollerRef.current.refresh() : load());
      return true;
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado");
      return false;
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
