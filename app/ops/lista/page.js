"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchEmergencies,
  getStoredUser,
  fetchCurrentUser,
  validateEmergency,
  discardEmergency,
  POLLING_INTERVAL_MS,
  ApiError,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  formatTimeShort,
  elapsedMinutes,
  isPendingStatus,
  isActiveStatus,
  priorityTextClass,
} from "../../lib/emergencies";
import GeoLabel from "../../components/civic/GeoLabel";
import DiscardReasonModal from "../../components/DiscardReasonModal";
import PageHeader from "../../components/PageHeader";
import { PriorityBadge, StatusBadge } from "../../components/ops/OpsBadges";
import { BTN_BASE, BTN_PRIMARY, BTN_SECONDARY } from "../../components/ops/buttonStyles";
import {
  TABLE_HEAD,
  TABLE_TH,
  TABLE_BODY,
  TABLE_ROW,
  TABLE_CELL,
  TABLE_CELL_MONO,
} from "../../components/ops/tableStyles";
import EmergencyMobileCard from "../../components/ops/EmergencyMobileCard";

function formatUpdatedAgo(lastUpdated, nowTick) {
  if (!lastUpdated) return "";
  const secs = Math.max(0, Math.round((nowTick - lastUpdated) / 1000));
  if (secs < 1) return "Actualizado ahora";
  return `Actualizado hace ${secs}s`;
}

export default function OpsPage() {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [alertAcked, setAlertAcked] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // requestSeq + AbortController: al retomar el polling (visibilitychange)
  // o disparar una carga manual mientras otra sigue en vuelo, se descarta la
  // respuesta vieja si llega después de una más nueva. fetchEmergencies()
  // (app/lib/api.js) todavía no acepta un AbortSignal, así que el abort()
  // no corta el fetch en la red, pero sí sirve como guarda para no pisar
  // estado con una respuesta obsoleta.
  const requestSeqRef = useRef(0);
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const seq = ++requestSeqRef.current;
    try {
      // TODO(back): reemplazar polling por webhook/Kafka consumer o SSE (HU-07)
      const data = await fetchEmergencies();
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      setEmergencies(data);
      setError("");
      setLastUpdated(Date.now());
      setSelected((prev) => {
        if (prev) {
          return data.find((e) => e.id === prev.id) || null;
        }
        return null;
      });
    } catch (err) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las emergencias"
      );
    }
  }, []);

  // Guard de sesión + polling. Se pausa cuando la pestaña no está visible
  // (document.visibilityState !== "visible") y se reanuda —con una carga
  // inmediata— al volver, en vez de seguir pegándole al backend en segundo
  // plano.
  useEffect(() => {
    let cancelled = false;
    let interval = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(load, POLLING_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
        startPolling();
      } else {
        stopPolling();
      }
    };

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
        return;
      }
      if (!cancelled && document.visibilityState === "visible") {
        startPolling();
      }
    })();

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      controllerRef.current?.abort();
    };
  }, [load, router]);

  // Tick de 1s para el indicador "actualizado hace Xs" del header, también
  // pausado mientras la pestaña está oculta.
  useEffect(() => {
    let tick = null;
    const start = () => {
      if (!tick) tick = setInterval(() => setNowTick(Date.now()), 1000);
    };
    const stop = () => {
      if (tick) {
        clearInterval(tick);
        tick = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const pending = emergencies.filter((e) => isPendingStatus(e.status));
  // Antes contaba "critical" y "high" juntas (ambas mapeaban al label
  // "ALTA"): el banner y la tarjeta "Críticas" mostraban 67 emergencias
  // "alta prioridad" cuando en realidad ninguna era crítica. Ahora cuenta
  // solo severity === "critical".
  const critical = emergencies.filter(
    (e) => e.severity === "critical" && isPendingStatus(e.status)
  );
  const showCriticalBanner = critical.length > 0 && !alertAcked;

  async function handleValidate() {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const updated = await validateEmergency(selected.id);
      setSelected(updated);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No se pudo validar"
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDiscard(reason) {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const updated = await discardEmergency(selected.id, reason);
      setSelected(updated);
      setDiscardOpen(false);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "No se pudo descartar"
      );
    } finally {
      setActionBusy(false);
    }
  }

  // Header + body del panel de detalle, compartido entre el bottom sheet
  // mobile y el panel lateral desktop (ver JSX más abajo).
  function renderDetailPanelBody() {
    if (!selected) return null;
    return (
      <>
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
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
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
            className={`${BTN_BASE} ${BTN_SECONDARY} w-full py-2 normal-case font-semibold text-xs`}
          >
            Cerrar detalle
          </button>
          {actionError && (
            <div className="p-2 rounded bg-error-container text-on-error-container text-xs">
              {actionError}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {isPendingStatus(selected.status) && (
              <>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleValidate}
                  className={`${BTN_BASE} ${BTN_PRIMARY} w-full py-2`}
                >
                  Validar
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setDiscardOpen(true)}
                  className={`${BTN_BASE} ${BTN_SECONDARY} w-full py-2`}
                >
                  Descartar
                </button>
              </>
            )}
            {(selected.status === "VALIDATED" ||
              selected.status === "validada") && (
              <button
                type="button"
                onClick={() => router.push(`/ops/asignar/${selected.id}`)}
                className={`${BTN_BASE} ${BTN_PRIMARY} w-full py-2`}
              >
                Asignar oficial
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Lista"
        right={
          lastUpdated ? (
            <span className="text-[10px] font-medium text-on-surface-variant whitespace-nowrap">
              {formatUpdatedAgo(lastUpdated, nowTick)}
            </span>
          ) : null
        }
      />
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
                  ? "border-2 border-priority-critical bg-error-container/20"
                  : "border-outline-variant"
              }`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-widest ${
                  s.critical ? "text-priority-critical" : "text-on-surface-variant"
                }`}
              >
                {s.label}
              </span>
              <span
                className={`text-xl sm:text-[28px] font-bold mt-1 ${
                  s.critical ? "text-priority-critical" : "text-on-surface"
                }`}
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
              <div className="bg-priority-critical text-on-primary px-3 sm:px-4 py-2 flex items-center justify-between gap-2 animate-pulse shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <MaterialIcon name="warning" filled size={16} />
                  <span className="text-xs sm:text-sm font-bold truncate">
                    {critical.length} EMERGENCIA{critical.length === 1 ? "" : "S"} CRÍTICA{critical.length === 1 ? "" : "S"}
                  </span>
                </div>
                <button
                  onClick={() => setAlertAcked(true)}
                  className="text-[11px] font-bold uppercase tracking-widest bg-on-primary/20 px-2 py-1 rounded hover:bg-on-primary/30 cursor-pointer transition-colors"
                >
                  ACK
                </button>
              </div>
            )}

            {/* Desktop & Tablet Table (Sin descripción para que entre en el contenedor) */}
            <div className="hidden sm:block flex-1 overflow-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead className={`sticky top-0 z-10 ${TABLE_HEAD}`}>
                  <tr>
                    {[
                      "Prioridad",
                      "Estado",
                      "Ubicación",
                      "Hora",
                      "Transcurrido",
                      "Usuario",
                    ].map((h) => (
                      <th key={h} className={TABLE_TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
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
                        className={`${TABLE_ROW} cursor-pointer ${
                          selected?.id === em.id
                            ? "bg-surface-container-low border-l-4 border-l-secondary"
                            : ""
                        }`}
                      >
                        <td className={TABLE_CELL}>
                          <PriorityBadge severity={em.severity || "critical"} />
                        </td>
                        <td className={TABLE_CELL}>
                          <StatusBadge status={em.status} />
                        </td>
                        <td className={`${TABLE_CELL} max-w-[200px] truncate`}>
                          <GeoLabel emergency={em} fallback="…" />
                        </td>
                        <td className={TABLE_CELL_MONO}>
                          {formatTimeShort(em.createdAt)}
                        </td>
                        <td
                          className={`${TABLE_CELL_MONO} font-bold ${
                            em.severity === "critical" || em.severity === "high"
                              ? priorityTextClass(em.severity)
                              : ""
                          }`}
                        >
                          {elapsedMinutes(em.createdAt)}
                        </td>
                        <td className={`${TABLE_CELL_MONO} text-on-surface-variant`}>
                          {em.userId}
                        </td>
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
                  <EmergencyMobileCard
                    key={em.id}
                    badges={
                      <>
                        <PriorityBadge severity={em.severity || "critical"} />
                        <StatusBadge status={em.status} />
                      </>
                    }
                    headline={elapsedMinutes(em.createdAt)}
                    location={<GeoLabel emergency={em} fallback="Obteniendo ubicación…" />}
                    idLabel={`#${em.id?.slice(0, 8)}`}
                    timeLabel={formatTimeShort(em.createdAt)}
                    selected={selected?.id === em.id}
                    onClick={() => {
                      setSelected(em);
                      if (isPendingStatus(em.status)) setAlertAcked(false);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Detalle de la emergencia seleccionada: bottom sheet modal con
              overlay en mobile/tablet (<lg), panel lateral fijo sin overlay en
              desktop (lg+). Antes era un único elemento que pasaba de
              `fixed inset-0` a `lg:static` en el breakpoint lg — en desktop
              terminaba con `position: static` y un `max-h-full` sin altura de
              referencia (contenedor sin alto definido), así que el panel
              crecía fuera de la vista en vez de quedar docked junto a la
              tabla. Separarlos en dos elementos independientes evita esa
              combinación frágil. */}
          {selected && (
            <>
              {/* Mobile / tablet: bottom sheet modal con overlay */}
              <div
                className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center lg:hidden"
                onClick={() => setSelected(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full sm:max-w-md bg-surface-container-lowest border border-outline-variant rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
                >
                  {renderDetailPanelBody()}
                </div>
              </div>

              {/* Desktop: panel lateral derecho de 360px, dentro del layout, sin overlay */}
              <div className="hidden lg:flex lg:w-[360px] lg:shrink-0 lg:self-stretch bg-surface-container-lowest border border-outline-variant rounded-lg flex-col shadow-sm overflow-hidden">
                {renderDetailPanelBody()}
              </div>
            </>
          )}
        </div>

        <DiscardReasonModal
          open={discardOpen}
          busy={actionBusy}
          onClose={() => {
            if (!actionBusy) setDiscardOpen(false);
          }}
          onConfirm={handleDiscard}
        />
      </main>
    </>
  );
}
