"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchEmergencies,
  CITIZEN_POLLING_INTERVAL_MS,
} from "../../lib/api";
import {
  formatTime,
  getStatusConfig,
  isActiveStatus,
  emergencyTitle,
  TYPE_LABELS,
} from "../../lib/emergencies";
import GeoLabel from "../../components/civic/GeoLabel";

function AlertCard({ emergency }) {
  const statusCfg = getStatusConfig(emergency.status);
  const active = isActiveStatus(emergency.status);
  const typeLabel =
    TYPE_LABELS[emergency.emergencyType] ||
    TYPE_LABELS[String(emergency.emergencyType || "").toLowerCase()];

  return (
    <article
      className={`bg-white rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-200 ${
        active && emergency.severity === "critical"
          ? "border border-error-container shadow-emergency-glow"
          : "border border-outline-variant shadow-ambient-lvl2"
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-lg flex items-center justify-center ${
              emergency.severity === "critical"
                ? "bg-error-container text-on-error-container"
                : "bg-surface-container-high text-on-surface"
            }`}
          >
            <MaterialIcon name="emergency" filled={active} size={20} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-xl font-semibold text-on-surface">
              {emergencyTitle(emergency)}
            </h3>
            <span className="text-xs font-medium text-on-surface-variant">
              {typeLabel ? `${typeLabel} · ` : ""}
              {formatTime(emergency.createdAt)}
            </span>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full flex items-center gap-1 text-xs font-bold ${statusCfg.badgeClass}`}
          title={statusCfg.label}
        >
          {statusCfg.label}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-lg border border-surface-container-highest">
        <MaterialIcon name="location_on" className="text-primary" />
        <p className="text-base text-on-surface font-medium">
          <GeoLabel emergency={emergency} fallback="Obteniendo dirección…" />
        </p>
      </div>

      <Link
        href={`/mis-alertas/${emergency.id}`}
        className="mt-2 w-full min-h-touch bg-surface-container-high hover:bg-surface-variant text-primary font-semibold text-sm tracking-wide rounded-lg transition-colors flex items-center justify-center gap-2 py-3"
      >
        Ver detalles
        <MaterialIcon name="arrow_forward" size={18} />
      </Link>
    </article>
  );
}

export default function MisAlertasPage() {
  const [tab, setTab] = useState("active");
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchEmergencies();
      setEmergencies(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "No se pudieron cargar las alertas");
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

  const activeAlerts = emergencies.filter((e) => isActiveStatus(e.status));
  const completedAlerts = emergencies.filter((e) => !isActiveStatus(e.status));
  const displayed = tab === "active" ? activeAlerts : completedAlerts;

  return (
    <>
      <CitizenTopBar title="Mis alertas" />

      <CitizenPageContainer className="gap-6 md:gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-[32px] font-bold text-primary">
            Mis alertas
          </h2>
          <p className="text-base text-on-surface-variant">
            Historial y estado de tus reportes de emergencia.
          </p>
        </div>

        <div className="flex w-full bg-surface-container-low rounded-lg p-1 border border-outline-variant/30">
          <button
            onClick={() => setTab("active")}
            className={`flex-1 min-h-touch flex items-center justify-center rounded-md font-semibold text-sm tracking-wide transition-all ${
              tab === "active"
                ? "bg-white shadow-sm text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            En curso ({activeAlerts.length})
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`flex-1 min-h-touch flex items-center justify-center rounded-md font-semibold text-sm tracking-wide transition-all ${
              tab === "completed"
                ? "bg-white shadow-sm text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Finalizadas ({completedAlerts.length})
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-on-surface-variant text-center py-12">Cargando…</p>
        ) : displayed.length > 0 ? (
          <section className="flex flex-col gap-4">
            {displayed.map((emergency) => (
              <AlertCard key={emergency.id} emergency={emergency} />
            ))}
          </section>
        ) : (
          <section className="flex flex-col gap-4 items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
              <MaterialIcon name="task_alt" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-on-surface">
              No hay alertas {tab === "active" ? "en curso" : "finalizadas"}
            </h3>
            <p className="text-base text-on-surface-variant max-w-[280px]">
              {tab === "active"
                ? "Cuando actives el botón de pánico, aparecerá aquí."
                : "Las emergencias canceladas o resueltas aparecerán aquí."}
            </p>
          </section>
        )}
      </CitizenPageContainer>
    </>
  );
}
