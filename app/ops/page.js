"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../components/civic/MaterialIcon";
import {
  fetchEmergencies,
  getStoredUser,
  fetchCurrentUser,
  POLLING_INTERVAL_MS,
  ApiError,
} from "../lib/api";
import { isDispatcher } from "../lib/auth";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  formatTimeShort,
  elapsedMinutes,
  locationLabel,
  hasValidCoords,
} from "../lib/emergencies";

function PriorityBadge({ severity }) {
  const cfg = PRIORITY_CONFIG[severity] || PRIORITY_CONFIG.medium;
  return (
    <div
      className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bg} inline-block`}
      style={{ color: `var(--color-${cfg.color})` }}
    >
      {cfg.label}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = getStatusConfig(status);
  return (
    <div
      className="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
      style={{
        backgroundColor: `color-mix(in srgb, var(--color-${cfg.color}) 20%, transparent)`,
        color: `var(--color-${cfg.color})`,
      }}
    >
      {cfg.label}
    </div>
  );
}

export default function OpsPage() {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [alertAcked, setAlertAcked] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // TODO(back): reemplazar polling por webhook/Kafka consumer o SSE (HU-07)
      const data = await fetchEmergencies();
      setEmergencies(data);
      setError("");
      setSelected((prev) => {
        if (!prev && data.length > 0) return data[0];
        if (prev) {
          return data.find((e) => e.id === prev.id) || prev;
        }
        return prev;
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las emergencias"
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) {
          router.replace("/inicio");
          return;
        }
        if (!cancelled) await load();
      } catch {
        router.replace("/acceso");
      }
    })();
    const interval = setInterval(load, POLLING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load, router]);

  const pending = emergencies.filter((e) => e.status === "CREATED");
  const critical = emergencies.filter(
    (e) =>
      (e.severity === "critical" || e.severity === "high") &&
      e.status === "CREATED"
  );
  const showCriticalBanner = critical.length > 0 && !alertAcked;

  return (
    <main className="p-3 sm:p-4 h-[calc(100vh-3rem)] lg:h-[calc(100vh-2.5rem)] flex flex-col gap-3 sm:gap-4 overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 shrink-0">
        {[
          { label: "Pendientes", value: pending.length },
          { label: "Total activas", value: emergencies.filter((e) => e.status === "CREATED" || e.status === "VALIDATED").length },
          {
            label: "Críticas",
            value: critical.length,
            critical: true,
          },
          {
            label: "Canceladas",
            value: emergencies.filter((e) => e.status === "CANCELLED").length,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`bg-surface-container-lowest border rounded p-3 flex flex-col ${
              s.critical
                ? "border-2 border-priority-high bg-error-container/20"
                : "border-outline-variant"
            }`}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
              style={
                s.critical ? { color: "var(--color-priority-high)" } : undefined
              }
            >
              {s.label}
            </span>
            <span
              className="text-xl sm:text-[28px] font-bold mt-1 text-on-surface"
              style={
                s.critical ? { color: "var(--color-priority-high)" } : undefined
              }
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded bg-error-container text-on-error-container text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 min-h-0">
        <div className="flex-1 flex flex-col bg-surface-container-lowest border border-outline-variant rounded overflow-hidden min-h-0">
          {showCriticalBanner && (
            <div className="bg-priority-high text-on-primary px-3 sm:px-4 py-2 flex items-center justify-between gap-2 animate-pulse shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <MaterialIcon name="warning" filled size={16} />
                <span className="text-xs sm:text-sm font-bold truncate">
                  {critical.length} EMERGENCIA(S) ALTA PRIORIDAD
                </span>
              </div>
              <button
                onClick={() => setAlertAcked(true)}
                className="text-[11px] font-bold uppercase tracking-widest bg-on-primary/20 px-2 py-1 rounded hover:bg-on-primary/30"
              >
                ACK
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container z-10">
                <tr>
                  {[
                    "Prioridad",
                    "Estado",
                    "Descripción",
                    "Ubicación",
                    "Hora",
                    "T. Transc",
                    "Usuario",
                  ].map((h) => (
                    <th
                      key={h}
                      className="p-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs bg-surface-container-lowest">
                {emergencies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-on-surface-variant"
                    >
                      No hay emergencias. Esperando botón de pánico…
                    </td>
                  </tr>
                ) : (
                  emergencies.map((em) => (
                    <tr
                      key={em.id}
                      onClick={() => {
                        setSelected(em);
                        if (em.status === "CREATED") setAlertAcked(false);
                      }}
                      className={`h-8 border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors cursor-pointer ${
                        selected?.id === em.id
                          ? "bg-surface-container-low border-l-4 border-l-secondary"
                          : ""
                      }`}
                    >
                      <td className="p-2">
                        <PriorityBadge severity={em.severity || "critical"} />
                      </td>
                      <td className="p-2">
                        <StatusBadge status={em.status} />
                      </td>
                      <td className="p-2 font-bold max-w-[200px] truncate">
                        {em.description}
                      </td>
                      <td className="p-2">{locationLabel(em)}</td>
                      <td className="p-2 font-mono text-[13px]">
                        {formatTimeShort(em.createdAt)}
                      </td>
                      <td
                        className="p-2 font-mono text-[13px] font-bold"
                        style={{
                          color:
                            em.severity === "critical" || em.severity === "high"
                              ? "var(--color-priority-high)"
                              : undefined,
                        }}
                      >
                        {elapsedMinutes(em.createdAt)}
                      </td>
                      <td className="p-2 font-mono">{em.userId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="w-full lg:w-[320px] shrink-0 bg-surface-container-lowest border border-outline-variant rounded flex flex-col shadow-xl max-h-[42vh] lg:max-h-none">
            <div className="p-4 border-b border-outline-variant bg-surface flex justify-between items-start">
              <div>
                <h2 className="text-sm font-bold text-on-surface font-mono truncate max-w-[220px]">
                  #{selected.id.slice(0, 8)}
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {getStatusConfig(selected.status).label} ·{" "}
                  {PRIORITY_CONFIG[selected.severity || "critical"]?.label}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="flex items-start gap-2">
                <MaterialIcon
                  name="location_on"
                  className="text-on-surface-variant mt-0.5"
                />
                <div>
                  <div className="text-sm font-bold text-on-surface">
                    {locationLabel(selected)}
                  </div>
                  {hasValidCoords(selected) && (
                    <div className="text-xs text-on-surface-variant">
                      lat {Number(selected.latitude).toFixed(5)} / lng{" "}
                      {Number(selected.longitude).toFixed(5)}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-surface-container-low p-3 rounded border border-outline-variant/50 text-xs">
                &quot;{selected.description}&quot;
              </div>
              <div className="text-xs text-on-surface-variant">
                <div>Usuario: <span className="font-mono">{selected.userId}</span></div>
                <div>Creada: {formatTimeShort(selected.createdAt)}</div>
              </div>
                            <p className="text-[11px] text-on-surface-variant/70 italic">
                {/* TODO(back): HU-05 validateEmergency / discardEmergency */}
                {/* TODO(back): HU-04 overridePriority · HU-06 asignar · HU-11 alerta critica */}
                {/* TODO(back): timeline + mapa real */}
                Validar / asignar aun no expuestos en el backend (solo lectura
                dispatcher).
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
