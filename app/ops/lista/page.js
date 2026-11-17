"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchOpsEmergencies,
  getStoredUser,
  fetchCurrentUser,
  validateEmergency,
  discardEmergency,
  POLLING_INTERVAL_MS,
  ApiError,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import { createPoller } from "../../lib/polling";
import {
  getStatusConfig,
  formatTimeShort,
  elapsedMinutes,
  isPendingStatus,
  isActiveStatus,
  canAssignOfficer,
  priorityTextClass,
  getEffectivePriority,
  TYPE_LABELS,
} from "../../lib/emergencies";
import GeoLabel from "../../components/civic/GeoLabel";
import DiscardReasonModal from "../../components/DiscardReasonModal";
import PageHeader from "../../components/PageHeader";
import {
  PriorityBadge,
  StatusBadge,
  getPriorityPill,
} from "../../components/ops/OpsBadges";
import {
  IncidentBadge,
  IncidentDetailBlock,
  ZoneContextBadge,
  ZoneContextNotice,
} from "../../components/ops/IncidentInfo";
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
import { shortEmergencyId } from "../../lib/boardLayout";
import { OriginBadge, OriginNotice } from "../../components/ops/OriginInfo";
import EmergencyDetailPanel from "../../components/ops/EmergencyDetailPanel";

// ── Helpers ───────────────────────────────────────────────────────────

function formatUpdatedAgo(lastUpdated, nowTick) {
  if (!lastUpdated) return "";
  const secs = Math.max(0, Math.round((nowTick - lastUpdated) / 1000));
  if (secs < 1) return "Actualizado ahora";
  if (secs < 60) return `Actualizado hace ${secs}s`;
  const mins = Math.floor(secs / 60);
  return `Actualizado hace ${mins}min`;
}

/** Devuelve la hora actual y re-renderiza a quien lo usa cada `intervalMs`,
 * solo con la pestaña visible (al volver se pone al día en el acto). */
function useVisibleTick(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let tick = null;
    const start = () => { if (!tick) tick = setInterval(() => setNow(Date.now()), intervalMs); };
    const stop = () => { if (tick) { clearInterval(tick); tick = null; } };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") { setNow(Date.now()); start(); } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [intervalMs]);

  return now;
}

/** "Actualizado hace Ns" con su propio tick de 1 s: el segundero re-renderiza
 * solo este texto y no la página entera (tarjetas, tabla y panel). */
function UpdatedAgo({ lastUpdated }) {
  const now = useVisibleTick(1000);
  return (
    <span className="text-[10px] font-medium text-on-surface-variant whitespace-nowrap">
      {formatUpdatedAgo(lastUpdated, now)}
    </span>
  );
}

/** Cada cuánto se re-renderiza la página para que avance "Transcurrido"
 * (elapsedMinutes, granularidad de minutos), aunque el poll falle o tarde. */
const ELAPSED_TICK_MS = 30_000;

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER = {
  PENDING: 0, pendiente: 0,
  VALIDATED: 1, validada: 1,
  DISPATCHED: 2, despachada: 2,
  EN_ROUTE: 3, en_camino: 3,
  ON_SITE: 4, ON_SCENE: 4, en_lugar: 4,
  RESOLVED: 5, resuelta: 5,
};

function getTypeLabel(em) {
  return (
    TYPE_LABELS[em.emergencyType] ||
    TYPE_LABELS[String(em.emergencyType || "").toLowerCase()] ||
    ""
  );
}

/** Extrae el texto de GeoLabel de forma síncrona para que pueda usarse en la búsqueda */
function getLocationText(em) {
  return em.address || em.location?.address || "";
}

function matchesSearch(em, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    em.id?.toLowerCase().includes(q) ||
    em.userId?.toLowerCase().includes(q) ||
    getTypeLabel(em).toLowerCase().includes(q) ||
    getLocationText(em).toLowerCase().includes(q) ||
    getStatusConfig(em.status).label.toLowerCase().includes(q)
  );
}

function sortEmergencies(list, sortKey, sortDir) {
  if (!sortKey) return list;
  return [...list].sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case "priority":
        va = SEVERITY_ORDER[getEffectivePriority(a)] ?? 99;
        vb = SEVERITY_ORDER[getEffectivePriority(b)] ?? 99;
        break;
      case "status":
        va = STATUS_ORDER[a.status] ?? 99;
        vb = STATUS_ORDER[b.status] ?? 99;
        break;
      case "time":
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
        break;
      case "elapsed":
        va = new Date(a.createdAt).getTime();
        vb = new Date(b.createdAt).getTime();
        // Más antiguo = más elapsed, así que invertimos la dirección natural
        [va, vb] = [vb, va];
        break;
      case "location":
        va = getLocationText(a).toLowerCase();
        vb = getLocationText(b).toLowerCase();
        break;
      case "user":
        va = (a.userId || "").toLowerCase();
        vb = (b.userId || "").toLowerCase();
        break;
      default:
        return 0;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── Componente de encabezado de columna sorteable ─────────────────────

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort }) {
  const active = currentKey === sortKey;
  // Tres estados: ▲ asc | ▼ desc | ○ sin sort
  const icon = active ? (currentDir === "asc" ? "▲" : "▼") : "○";
  return (
    <th
      className={`${TABLE_TH} select-none cursor-pointer group hover:bg-surface-container-high transition-colors`}
      onClick={() => onSort(sortKey)}
      title={
        active
          ? currentDir === "asc"
            ? `Ordenar por ${label} descendente`
            : `Quitar orden por ${label}`
          : `Ordenar por ${label}`
      }
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={`text-[10px] transition-opacity ${
          active ? "opacity-100" : "opacity-30 group-hover:opacity-70"
        }`}>
          {icon}
        </span>
      </span>
    </th>
  );
}

// ── Constantes de filtro de métricas ──────────────────────────────────

/** KPI "Críticas" y banner: misma prioridad efectiva que la columna de la
 * tabla (antes usaban `severity` y no contaban las elevadas por incidente). */
function isCriticalPending(e) {
  return getEffectivePriority(e) === "critical" && isPendingStatus(e.status);
}

// Sin "Canceladas": fetchOpsEmergencies() trae solo las abiertas, así que esa
// tarjeta quedaba siempre en 0. Las canceladas se ven en /ops/historial.
const METRIC_FILTERS = {
  all: () => true,
  pending: (e) => isPendingStatus(e.status),
  active: (e) => isActiveStatus(e.status),
  critical: isCriticalPending,
};

// ── Página principal ──────────────────────────────────────────────────

export default function OpsPage() {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [alertAcked, setAlertAcked] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  // "Transcurrido" se calcula al renderizar: sin esto solo avanzaría cuando
  // llega un poll bueno.
  useVisibleTick(ELAPSED_TICK_MS);

  // ── Controles de datos ────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [metricFilter, setMetricFilter] = useState("all"); // clave de METRIC_FILTERS
  // Por defecto la lista entra ordenada por prioridad (críticas primero):
  // la priorización es el feature central del panel, así que el dispatcher
  // no debería tener que clickear el header para verla ordenada. SEVERITY_ORDER
  // pone critical=0, así que "priority"+"asc" deja críticas arriba.
  const [sortKey, setSortKey] = useState("priority");
  const [sortDir, setSortDir] = useState("asc");

  const pollerRef = useRef(null);

  // createPoller no superpone pedidos, así que las respuestas llegan en
  // orden y no hace falta descartar las viejas.
  const load = useCallback(async () => {
    try {
      const data = await fetchOpsEmergencies();
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
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudieron cargar las emergencias"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Guard de sesión + polling (pausa con la pestaña oculta, ver createPoller)
  useEffect(() => {
    let cancelled = false;
    const poller = createPoller({ load, intervalMs: POLLING_INTERVAL_MS });
    pollerRef.current = poller;

    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) { router.replace("/inicio"); return; }
      } catch {
        router.replace("/acceso");
        return;
      }
      if (!cancelled) poller.start();
    })();

    return () => {
      cancelled = true;
      poller.stop();
    };
  }, [load, router]);

  // ── Datos derivados ───────────────────────────────────────────────

  const pending = emergencies.filter(METRIC_FILTERS.pending);
  const critical = emergencies.filter(METRIC_FILTERS.critical);
  const totalActive = emergencies.filter(METRIC_FILTERS.active);
  const showCriticalBanner = critical.length > 0 && !alertAcked;

  // Métricas de las tarjetas
  const METRIC_CARDS = [
    { key: "all",      label: "Total",       value: emergencies.length,  critical: false },
    { key: "pending",  label: "Pendientes",  value: pending.length,      critical: false },
    { key: "active",   label: "Total activas", value: totalActive.length, critical: false },
    { key: "critical", label: "Críticas",    value: critical.length,     critical: true  },
  ];

  // Pipeline: filtro por métrica → búsqueda → sort
  const displayedEmergencies = useMemo(() => {
    let list = emergencies.filter(METRIC_FILTERS[metricFilter] ?? (() => true));
    list = list.filter((e) => matchesSearch(e, searchQuery));
    list = sortEmergencies(list, sortKey, sortDir);
    return list;
  }, [emergencies, metricFilter, searchQuery, sortKey, sortDir]);

  function handleMetricClick(key) {
    setMetricFilter((prev) => (prev === key ? "all" : key));
    setSelected(null);
  }

  function handleSort(key) {
    // Ciclo 3 estados por columna: asc → desc → sin sort (orden original)
    if (sortKey !== key) {
      // Nueva columna: siempre empieza en ascendente
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      // 2.º click sobre la misma columna: invertir
      setSortDir("desc");
    } else {
      // 3.er click: quitar el sort y volver al orden original
      setSortKey(null);
      setSortDir("asc");
    }
  }

  // ── Acciones ──────────────────────────────────────────────────────

  async function handleValidate() {
    if (!selected || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const updated = await validateEmergency(selected.id);
      setSelected(updated);
      await pollerRef.current?.refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo validar");
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
      await pollerRef.current?.refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "No se pudo descartar");
    } finally {
      setActionBusy(false);
    }
  }

  // ── Panel de detalle (compartido mobile/desktop) ──────────────────

  function renderDetailPanelBody() {
    if (!selected) return null;

    const canValidate = isPendingStatus(selected.status);
    const canAssign = canAssignOfficer(selected.status);

    return (
      <>
        <div className="p-4 border-b border-outline-variant bg-surface flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-sm font-bold text-on-surface font-mono truncate max-w-[220px]">
              #{shortEmergencyId(selected.id)}
            </h2>
            <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              {getStatusConfig(selected.status).label} ·{" "}
              {getPriorityPill(getEffectivePriority(selected)).label}
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

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
          <div className="flex items-start gap-2">
            <MaterialIcon name="location_on" className="text-on-surface-variant mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Ubicación
              </span>
              <div className="text-sm font-bold text-on-surface">
                <GeoLabel emergency={selected} fallback="Obteniendo dirección…" />
              </div>
            </div>
          </div>

          <OriginNotice emergency={selected} />
          <IncidentDetailBlock emergency={selected} />
          <ZoneContextNotice emergency={selected} />

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
              {/* Las externas no tienen usuario: el origen va arriba. */}
              <span className="font-mono font-medium text-on-surface">{selected.userId || "—"}</span>
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

          {actionError && (
            <div className="p-2 rounded bg-error-container text-on-error-container text-xs">
              {actionError}
            </div>
          )}

          {/* Acciones arriba de "Cerrar": en mobile no quedan bajo el fold. */}
          <div className="flex flex-col gap-2">
            {canValidate && (
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
            {canAssign && (
              <button
                type="button"
                onClick={() => router.push(`/ops/asignar/${selected.id}`)}
                className={`${BTN_BASE} ${BTN_PRIMARY} w-full py-2`}
              >
                Asignar oficial
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={`${BTN_BASE} ${BTN_SECONDARY} w-full py-2 normal-case font-semibold text-xs`}
            >
              Cerrar detalle
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Columnas de la tabla ──────────────────────────────────────────

  const SORTABLE_COLS = [
    { label: "Prioridad",    key: "priority"  },
    { label: "Estado",       key: "status"    },
    { label: "Ubicación",    key: "location"  },
    { label: "Hora",         key: "time"      },
    { label: "Transcurrido", key: "elapsed"   },
    { label: "Usuario",      key: "user"      },
  ];

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Lista"
        right={
          lastUpdated ? <UpdatedAgo lastUpdated={lastUpdated} /> : null
        }
      />
      <main className="p-3 sm:p-4 flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">

        {/* ── Tarjetas de métricas clickeables ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
          {METRIC_CARDS.map((s) => {
            const isActive = metricFilter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleMetricClick(s.key)}
                title={isActive ? "Quitar filtro" : `Filtrar por ${s.label}`}
                className={`text-left rounded-lg p-3 flex flex-col transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-primary ${
                  s.critical
                    ? isActive
                      ? "border-2 border-priority-critical bg-error-container/40 ring-2 ring-priority-critical ring-offset-1"
                      : "border-2 border-priority-critical bg-error-container/20 hover:bg-error-container/35"
                    : isActive
                      ? "border-2 border-primary bg-surface-container ring-2 ring-primary/30 ring-offset-1"
                      : "border border-outline-variant bg-surface-container-lowest hover:bg-surface-container"
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest ${
                    s.critical ? "text-priority-critical" : isActive ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {s.label}
                </span>
                <span
                  className={`text-xl sm:text-[28px] font-bold mt-1 ${
                    s.critical ? "text-priority-critical" : isActive ? "text-primary" : "text-on-surface"
                  }`}
                >
                  {loading ? "—" : s.value}
                </span>
                {isActive && (
                  <span className="text-[10px] mt-1 font-semibold text-primary/70 flex items-center gap-0.5">
                    <MaterialIcon name="filter_alt" size={12} /> Activo
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Barra de búsqueda ── */}
        <div className="shrink-0 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus-within:border-primary transition-colors">
          <MaterialIcon name="search" size={18} className="text-on-surface-variant shrink-0" />
          <input
            id="ops-lista-search"
            type="search"
            placeholder="Buscar por ID, usuario, tipo, ubicación o estado…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setSearchQuery("")}
              className="text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <MaterialIcon name="close" size={16} />
            </button>
          )}
        </div>

        {/* ── Indicador de filtro activo ── */}
        {(metricFilter !== "all" || searchQuery) && (
          <div className="shrink-0 flex items-center gap-2 flex-wrap text-xs text-on-surface-variant">
            <span>Mostrando {displayedEmergencies.length} resultado{displayedEmergencies.length !== 1 ? "s" : ""}</span>
            {metricFilter !== "all" && (
              <button
                type="button"
                onClick={() => setMetricFilter("all")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                <MaterialIcon name="filter_alt" size={12} />
                {METRIC_CARDS.find((c) => c.key === metricFilter)?.label}
                <MaterialIcon name="close" size={12} />
              </button>
            )}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                <MaterialIcon name="search" size={12} />
                &ldquo;{searchQuery}&rdquo;
                <MaterialIcon name="close" size={12} />
              </button>
            )}
          </div>
        )}

        {loading && (
          <p role="status" className="sr-only">Cargando emergencias…</p>
        )}

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

            {/* Desktop & Tablet Table */}
            <div className="hidden sm:block flex-1 overflow-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead className={`sticky top-0 z-10 ${TABLE_HEAD}`}>
                  <tr>
                    {SORTABLE_COLS.map((col) => (
                      <SortableHeader
                        key={col.key}
                        label={col.label}
                        sortKey={col.key}
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={handleSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse" aria-hidden="true">
                        <td colSpan={6} className="p-2.5">
                          <div className="h-5 rounded bg-surface-container" />
                        </td>
                      </tr>
                    ))
                  ) : displayedEmergencies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                        {emergencies.length === 0
                          ? "No hay emergencias. Esperando botón de pánico…"
                          : "Ninguna emergencia coincide con la búsqueda."}
                      </td>
                    </tr>
                  ) : (
                    displayedEmergencies.map((em) => (
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PriorityBadge severity={getEffectivePriority(em)} />
                            <IncidentBadge emergency={em} />
                            <ZoneContextBadge emergency={em} />
                            <OriginBadge emergency={em} />
                          </div>
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
                            getEffectivePriority(em) === "critical" ||
                            getEffectivePriority(em) === "high"
                              ? priorityTextClass(getEffectivePriority(em))
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

            {/* Mobile Card List */}
            <div className="sm:hidden flex-1 overflow-auto divide-y divide-outline-variant/40">
              {loading ? (
                <div className="flex flex-col gap-2.5 p-3 animate-pulse" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-surface-container" />
                  ))}
                </div>
              ) : displayedEmergencies.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-xs">
                  {emergencies.length === 0
                    ? "No hay emergencias. Esperando botón de pánico…"
                    : "Ninguna emergencia coincide con la búsqueda."}
                </div>
              ) : (
                displayedEmergencies.map((em) => (
                  <EmergencyMobileCard
                    key={em.id}
                    badges={
                      <>
                        <PriorityBadge severity={getEffectivePriority(em)} />
                        <StatusBadge status={em.status} />
                        <IncidentBadge emergency={em} />
                        <ZoneContextBadge emergency={em} />
                        <OriginBadge emergency={em} />
                      </>
                    }
                    headline={elapsedMinutes(em.createdAt)}
                    location={<GeoLabel emergency={em} fallback="Obteniendo ubicación…" />}
                    idLabel={`#${shortEmergencyId(em.id)}`}
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

          {/* Panel lateral / bottom sheet */}
          <EmergencyDetailPanel open={Boolean(selected)} onClose={() => setSelected(null)}>
            {renderDetailPanelBody()}
          </EmergencyDetailPanel>
        </div>

        <DiscardReasonModal
          open={discardOpen}
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setDiscardOpen(false); }}
          onConfirm={handleDiscard}
        />
      </main>
    </>
  );
}
