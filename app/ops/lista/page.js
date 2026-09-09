"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchEmergencies,
  getStoredUser,
  fetchCurrentUser,
  POLLING_INTERVAL_MS,
  ApiError,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  formatTimeShort,
  elapsedMinutes,
  hasValidCoords,
  isPendingStatus,
  isActiveStatus,
} from "../../lib/emergencies";
import GeoLabel from "../../components/civic/GeoLabel";

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
        if (prev) {
          return data.find((e) => e.id === prev.id) || null;
        }
        return null;
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

  const pending = emergencies.filter((e) => isPendingStatus(e.status));
  const critical = emergencies.filter(
    (e) =>
      (e.severity === "critical" || e.severity === "high") &&
      isPendingStatus(e.status)
  );
  const showCriticalBanner = critical.length > 0 && !alertAcked;

  return (
    <main className="p-3 sm:p-4 flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 shrink-0">
        {[
          { label: "Pendientes", value: pending.length },
          {
            label: "Total activas",
            value: emergencies.filter(
              (e) => isActiveStatus(e.status) && e.status !== "CANCELLED"
            ).length,
          },
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
            className={`bg-surface-container-lowest border rounded-lg p-3 flex flex-col ${
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

      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 min-h-0 relative">
        <div className="flex-1 flex flex-col bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden min-h-0 w-full">
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

          {/* Desktop & Tablet Table (Sin descripción para que entre en el contenedor) */}
          <div className="hidden sm:block flex-1 overflow-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container z-10">
                <tr>
                  {[
                    "Prioridad",
                    "Estado",
                    "Ubicación",
                    "Hora",
                    "Transcurrido",
                    "Usuario",
                  ].map((h) => (
                    <th
                      key={h}
                      className="p-2.5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant"
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
                      colSpan={6}
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
                        setSelected((prev) => (prev?.id === em.id ? null : em));
                        if (isPendingStatus(em.status)) setAlertAcked(false);
                      }}
                      className={`h-10 border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors cursor-pointer ${
                        selected?.id === em.id
                          ? "bg-surface-container-low border-l-4 border-l-secondary"
                          : ""
                      }`}
                    >
                      <td className="p-2.5">
                        <PriorityBadge severity={em.severity || "critical"} />
                      </td>
                      <td className="p-2.5">
                        <StatusBadge status={em.status} />
                      </td>
                      <td className="p-2.5 max-w-[200px] truncate">
                        <GeoLabel emergency={em} fallback="…" />
                      </td>
                      <td className="p-2.5 font-mono text-[13px]">
                        {formatTimeShort(em.createdAt)}
                      </td>
                      <td
                        className="p-2.5 font-mono text-[13px] font-bold"
                        style={{
                          color:
                            em.severity === "critical" || em.severity === "high"
                              ? "var(--color-priority-high)"
                              : undefined,
                        }}
                      >
                        {elapsedMinutes(em.createdAt)}
                      </td>
                      <td className="p-2.5 font-mono text-on-surface-variant">{em.userId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (Ajustado al contenedor móvil, detalle al tocar) */}
          <div className="sm:hidden flex-1 overflow-auto divide-y divide-outline-variant/40">
            {emergencies.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-xs">
                No hay emergencias. Esperando botón de pánico…
              </div>
            ) : (
              emergencies.map((em) => (
                <div
                  key={em.id}
                  onClick={() => {
                    setSelected(em);
                    if (isPendingStatus(em.status)) setAlertAcked(false);
                  }}
                  className={`p-3 flex flex-col gap-2 active:bg-surface-container-low transition-colors cursor-pointer ${
                    selected?.id === em.id ? "bg-surface-container-low border-l-4 border-l-secondary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge severity={em.severity || "critical"} />
                      <StatusBadge status={em.status} />
                    </div>
                    <span className="font-mono text-xs font-bold text-on-surface-variant">
                      {elapsedMinutes(em.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-on-surface">
                    <MaterialIcon name="location_on" size={16} className="text-on-surface-variant shrink-0" />
                    <span className="truncate">
                      <GeoLabel emergency={em} fallback="Obteniendo ubicación…" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span className="font-mono">#{em.id?.slice(0, 8)}</span>
                    <span className="font-mono">{formatTimeShort(em.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal / Drawer de Detalle (Aparece cuando se toca una emergencia) */}
        {selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:p-0">
            <div className="w-full sm:max-w-md lg:w-[320px] bg-surface-container-lowest border border-outline-variant rounded-t-2xl sm:rounded-xl lg:rounded-lg flex flex-col shadow-2xl max-h-[85vh] lg:max-h-full overflow-hidden shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-200">
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
                  type="button"
                  aria-label="Cerrar detalle"
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <MaterialIcon name="close" size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex items-start gap-2">
                  <MaterialIcon
                    name="location_on"
                    className="text-on-surface-variant mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                      Ubicación
                    </span>
                    <div className="text-sm font-bold text-on-surface">
                      <GeoLabel
                        emergency={selected}
                        fallback="Obteniendo dirección…"
                        showCoords
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                    Descripción del Incidente
                  </span>
                  <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50 text-xs text-on-surface leading-relaxed">
                    &quot;{selected.description}&quot;
                  </div>
                </div>

                <div className="text-xs text-on-surface-variant flex flex-col gap-1 border-t border-outline-variant/40 pt-3">
                  <div className="flex justify-between">
                    <span>Usuario:</span>
                    <span className="font-mono font-medium text-on-surface">{selected.userId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hora de reporte:</span>
                    <span className="font-mono font-medium text-on-surface">{formatTimeShort(selected.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo transcurrido:</span>
                    <span className="font-mono font-bold text-on-surface">{elapsedMinutes(selected.createdAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-2 w-full py-2 bg-surface-container text-on-surface text-xs font-semibold rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors"
                >
                  Cerrar detalle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
