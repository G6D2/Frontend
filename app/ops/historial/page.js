"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  fetchEmergenciesPage,
  fetchEmergencyDetail,
  getStoredUser,
  fetchCurrentUser,
  ApiError,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import {
  TYPE_LABELS,
  formatTimeShort,
  getEffectivePriority,
  getEmergencyReason,
} from "../../lib/emergencies";
import GeoLabel from "../../components/civic/GeoLabel";
import PageHeader from "../../components/PageHeader";
import { PriorityBadge, StatusBadge } from "../../components/ops/OpsBadges";
import { IncidentBadge, IncidentDetailBlock } from "../../components/ops/IncidentInfo";
import EmergencyMobileCard from "../../components/ops/EmergencyMobileCard";
import EmergencyDetailPanel from "../../components/ops/EmergencyDetailPanel";
import { BTN_BASE, BTN_SECONDARY } from "../../components/ops/buttonStyles";
import {
  TABLE_CONTAINER,
  TABLE_HEAD,
  TABLE_TH,
  TABLE_BODY,
  TABLE_ROW,
  TABLE_CELL,
  TABLE_CELL_MONO,
} from "../../components/ops/tableStyles";

// ── Constantes ────────────────────────────────────────────────────────

// Estados terminales que muestra el historial (issue #46). RESOLVED se
// incluye por si el backend llega a usarlo como paso previo a CLOSED — hoy
// (2026-09) las transiciones reales cierran vía CLOSED/CANCELLED/DISCARDED.
const TERMINAL_STATUSES = ["CLOSED", "CANCELLED", "DISCARDED", "RESOLVED"];
const PAGE_SIZE = 20;

// Filtros de métricas por estado y prioridad (client-side)
const METRIC_FILTERS = {
  all: () => true,
  closed: (e) => e.status === "CLOSED" || e.status === "RESOLVED",
  cancelled: (e) => e.status === "CANCELLED",
  discarded: (e) => e.status === "DISCARDED",
  critical: (e) => (getEffectivePriority(e) || e.severity) === "critical",
};

// Pills de filtro por tipo de incidente (client-side)
const TYPE_FILTER_OPTIONS = [
  { key: "all",           label: "Todos los tipos",  match: null },
  { key: "panic",         label: "Pánico",           match: ["PANICO", "panic"] },
  { key: "medical",       label: "Médica",           match: ["MEDICA", "medical"] },
  { key: "fire",          label: "Incendio",         match: ["INCENDIO", "fire"] },
  { key: "infrastructure",label: "Infraestructura",  match: ["INFRAESTRUCTURA", "infrastructure"] },
  { key: "disturbance",   label: "Disturbio",        match: ["DISTURBIO_EVENTO_MASIVO", "disturbance"] },
  { key: "other",         label: "Otro",             match: ["OTRO", "other"] },
  { key: "transit",       label: "Tránsito",         match: ["TRANSITO"] },
  { key: "preventive",    label: "Preventiva",       match: ["PREVENTIVA"] },
];

const DESKTOP_COLUMNS = [
  { label: "ID",        key: "id"       },
  { label: "Tipo",      key: "type"     },
  { label: "Prioridad", key: "priority" },
  { label: "Ubicación", key: "location" },
  { label: "Estado",    key: "status"   },
  { label: "Cierre",    key: "closed"   },
  { label: "Oficial",   key: "officer"  },
  { label: "Motivo",    key: "reason"   },
];

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Helpers ───────────────────────────────────────────────────────────

function typeLabelOf(emergency) {
  return (
    TYPE_LABELS[emergency?.emergencyType] ||
    TYPE_LABELS[String(emergency?.emergencyType || "").toLowerCase()] ||
    "—"
  );
}

/** assignedOfficer hoy es un string (ver mapEmergency del backend), pero se
 * cubre también el caso de que llegue a ser un objeto `{ name }`. */
function officerLabel(emergency) {
  const officer = emergency?.assignedOfficer;
  if (!officer) return "—";
  if (typeof officer === "string") return officer;
  if (typeof officer === "object") return officer.name || officer.badgeNumber || "—";
  return "—";
}

function closedAtOf(emergency) {
  return emergency?.closedAt || emergency?.updatedAt || null;
}

function getLocationText(em) {
  return em?.address || em?.location?.address || "";
}

/** Ordena por hora de cierre (closedAt, o updatedAt si no hay) desc. */
function sortByClosedDesc(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(closedAtOf(a) || 0).getTime();
    const tb = new Date(closedAtOf(b) || 0).getTime();
    return tb - ta;
  });
}

function matchesSearch(row, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    row.id?.toLowerCase().includes(q) ||
    typeLabelOf(row).toLowerCase().includes(q) ||
    officerLabel(row).toLowerCase().includes(q) ||
    (getEmergencyReason(row) || "").toLowerCase().includes(q) ||
    getLocationText(row).toLowerCase().includes(q)
  );
}

function matchesType(row, typeKey) {
  if (typeKey === "all" || typeKey === null) return true;
  const opt = TYPE_FILTER_OPTIONS.find((o) => o.key === typeKey);
  if (!opt?.match) return true;
  return opt.match.includes(row.emergencyType);
}

function sortItems(list, sortKey, sortDir) {
  if (!sortKey) return list;
  return [...list].sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case "id":
        va = a.id || "";
        vb = b.id || "";
        break;
      case "type":
        va = typeLabelOf(a);
        vb = typeLabelOf(b);
        break;
      case "priority":
        va = SEVERITY_ORDER[getEffectivePriority(a)] ?? 99;
        vb = SEVERITY_ORDER[getEffectivePriority(b)] ?? 99;
        break;
      case "location":
        va = getLocationText(a).toLowerCase();
        vb = getLocationText(b).toLowerCase();
        break;
      case "status":
        va = a.status || "";
        vb = b.status || "";
        break;
      case "closed":
        va = new Date(closedAtOf(a) || 0).getTime();
        vb = new Date(closedAtOf(b) || 0).getTime();
        break;
      case "officer":
        va = officerLabel(a).toLowerCase();
        vb = officerLabel(b).toLowerCase();
        break;
      case "reason":
        va = (getEmergencyReason(a) || "").toLowerCase();
        vb = (getEmergencyReason(b) || "").toLowerCase();
        break;
      default:
        return 0;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── Componente de encabezado sorteable ───────────────────────────────

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

// ── Skeleton ──────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      <div className={`hidden sm:block ${TABLE_CONTAINER} animate-pulse`}>
        <div className="p-2.5 bg-surface-container h-10" />
        <div className="divide-y divide-outline-variant/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-container-lowest" />
          ))}
        </div>
      </div>
      <div className="sm:hidden flex flex-col gap-2.5 w-full animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-surface-container-lowest border border-outline-variant rounded-lg"
          />
        ))}
      </div>
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────

export default function HistorialPage() {
  const router = useRouter();

  // Filtro por métrica (tarjetas clickeables)
  const [metricFilter, setMetricFilter] = useState("all");
  // Datos
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Controles client-side
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("closed");
  const [sortDir, setSortDir] = useState("desc");

  const requestSeqRef = useRef(0);

  const load = useCallback(async (pageToLoad = 1, { append = false } = {}) => {
    const seq = ++requestSeqRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const { data, pagination: nextPagination } = await fetchEmergenciesPage({
        status: TERMINAL_STATUSES.join(","),
        page: pageToLoad,
        limit: PAGE_SIZE,
      });
      if (seq !== requestSeqRef.current) return;
      // sortByClosedDesc es el orden por defecto del servidor; el sort
      // interactivo se aplica luego en el useMemo.
      setItems((prev) => sortByClosedDesc(append ? [...prev, ...data] : data));
      setPagination(nextPagination);
      setPage(pageToLoad);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el historial");
    } finally {
      if (seq !== requestSeqRef.current) return;
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) { router.replace("/inicio"); return; }
        if (!cancelled) await load(1);
      } catch {
        router.replace("/acceso");
      }
    })();
    return () => { cancelled = true; };
  }, [load, router]);

  function handleRetry() { load(1); }

  function handleLoadMore() {
    if (loadingMore || !pagination) return;
    if (page >= pagination.totalPages) return;
    load(page + 1, { append: true });
  }

  // Al abrir el detalle se hidrata con GET /api/emergencies/:id (trae
  // statusHistory), que expone el motivo real de cierre/descarte —el
  // listado no lo manda. getEmergencyReason (app/lib/emergencies.js) lee
  // ambas formas y cae a "—" si no hay nada.
  async function handleSelect(row) {
    setSelected(row);
    if (row.statusHistory) return;
    try {
      const detail = await fetchEmergencyDetail(row.id);
      setSelected((prev) => (prev?.id === row.id ? { ...row, ...detail } : prev));
    } catch {
      // El panel se queda con lo que ya tenía (motivo "—" si no hay campo directo).
    }
  }

  function handleSort(key) {
    // Ciclo 3 estados por columna: asc → desc → sin sort (orden original)
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
  }

  // Métricas para las tarjetas de resumen
  const closedCount = items.filter((e) => e.status === "CLOSED" || e.status === "RESOLVED").length;
  const cancelledCount = items.filter((e) => e.status === "CANCELLED").length;
  const discardedCount = items.filter((e) => e.status === "DISCARDED").length;
  const criticalCount = items.filter((e) => (getEffectivePriority(e) || e.severity) === "critical").length;

  const METRIC_CARDS = [
    { key: "all",       label: "Total",       value: items.length,    critical: false },
    { key: "closed",    label: "Cerradas",    value: closedCount,     critical: false },
    { key: "cancelled", label: "Canceladas",  value: cancelledCount,  critical: false },
    { key: "discarded", label: "Descartadas", value: discardedCount,  critical: false },
    { key: "critical",  label: "Críticas",    value: criticalCount,   critical: true  },
  ];

  function handleMetricClick(key) {
    setMetricFilter((prev) => (prev === key ? "all" : key));
    setSelected(null);
  }

  // Pipeline client-side: filtro de métrica → búsqueda de texto → filtro de tipo → sort
  const displayedItems = useMemo(() => {
    let list = items.filter(METRIC_FILTERS[metricFilter] ?? (() => true));
    list = list.filter((row) => matchesSearch(row, searchQuery));
    list = list.filter((row) => matchesType(row, typeFilter));
    list = sortItems(list, sortKey, sortDir);
    return list;
  }, [items, metricFilter, searchQuery, typeFilter, sortKey, sortDir]);

  const hasMore = Boolean(pagination && page < pagination.totalPages);
  const hasActiveClientFilters = searchQuery || typeFilter !== "all" || metricFilter !== "all";

  function renderDetailPanelBody() {
    if (!selected) return null;
    return (
      <>
        <div className="p-4 border-b border-outline-variant bg-surface flex justify-between items-start">
          <div>
            <h2 className="text-sm font-bold text-on-surface font-mono truncate max-w-[220px]">
              #{selected.id?.slice(0, 8)}
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <StatusBadge status={selected.status} />
              <PriorityBadge severity={getEffectivePriority(selected) || "critical"} />
              <IncidentBadge emergency={selected} />
            </div>
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
            <MaterialIcon name="location_on" className="text-on-surface-variant mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Ubicación
              </span>
              <div className="text-sm font-bold text-on-surface">
                <GeoLabel emergency={selected} fallback="Sin dirección" showCoords />
              </div>
            </div>
          </div>

          <IncidentDetailBlock emergency={selected} />

          {selected.description && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Descripción
              </span>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50 text-xs text-on-surface leading-relaxed">
                &quot;{selected.description}&quot;
              </div>
            </div>
          )}

          <div className="text-xs text-on-surface-variant flex flex-col gap-1 border-t border-outline-variant/40 pt-3">
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Tipo:</span>
              <span className="font-medium text-on-surface text-right">{typeLabelOf(selected)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Oficial:</span>
              <span className="font-medium text-on-surface text-right">{officerLabel(selected)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Hora de cierre:</span>
              <span className="font-mono font-medium text-on-surface">{formatTimeShort(closedAtOf(selected))}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Motivo:</span>
              <span className="font-medium text-on-surface text-right max-w-[220px]">
                {getEmergencyReason(selected) || "—"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`${BTN_BASE} ${BTN_SECONDARY} w-full py-2 normal-case font-semibold text-xs`}
          >
            Cerrar detalle
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Historial" />
      <main className="p-3 sm:p-4 w-full flex flex-col gap-3 sm:gap-4">

        {/* ── Tarjetas de métricas clickeables ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 shrink-0">
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
                  {s.value}
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
            id="historial-search"
            type="search"
            placeholder="Buscar por ID, tipo, oficial, motivo o ubicación…"
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

        {/* ── Pills de filtro por tipo (client-side) ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Tipo:
          </span>
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTypeFilter((prev) => (prev === opt.key ? "all" : opt.key))}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                typeFilter === opt.key
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Indicador de filtros activos ── */}
        {hasActiveClientFilters && !loading && (
          <div className="shrink-0 flex items-center gap-2 flex-wrap text-xs text-on-surface-variant">
            <span>
              Mostrando {displayedItems.length} de {items.length} resultado{items.length !== 1 ? "s" : ""}
            </span>
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
            {typeFilter !== "all" && (
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors"
              >
                <MaterialIcon name="category" size={12} />
                {TYPE_FILTER_OPTIONS.find((o) => o.key === typeFilter)?.label}
                <MaterialIcon name="close" size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMetricFilter("all");
                setSearchQuery("");
                setTypeFilter("all");
              }}
              className="text-primary hover:underline cursor-pointer ml-1"
            >
              Limpiar todos
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 p-3 rounded bg-error-container text-on-error-container text-sm shrink-0">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              className="shrink-0 px-3 py-1 rounded bg-on-error-container/10 hover:bg-on-error-container/20 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading && items.length === 0 && !error && <SkeletonRows />}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-on-surface-variant">
            <MaterialIcon name="inbox" size={32} />
            <p className="text-sm font-medium">Todavía no hay emergencias cerradas</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && displayedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-on-surface-variant">
            <MaterialIcon name="search_off" size={32} />
            <p className="text-sm font-medium">Ningún resultado coincide con los filtros</p>
            <button
              type="button"
              onClick={() => {
                setMetricFilter("all");
                setSearchQuery("");
                setTypeFilter("all");
              }}
              className="text-xs text-primary hover:underline cursor-pointer mt-1"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {items.length > 0 && displayedItems.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 relative items-start">
            <div className="flex-1 flex flex-col gap-3 sm:gap-4 min-w-0 w-full">

              {/* Desktop / Tablet */}
              <div className={`hidden sm:block ${TABLE_CONTAINER}`}>
                <table className="w-full text-left border-collapse">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      {DESKTOP_COLUMNS.map((col) => (
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
                    {displayedItems.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => handleSelect(row)}
                        className={`${TABLE_ROW} cursor-pointer ${
                          selected?.id === row.id
                            ? "bg-surface-container-low border-l-4 border-l-secondary"
                            : ""
                        }`}
                      >
                        <td className={TABLE_CELL_MONO}>{row.id?.slice(0, 8)}</td>
                        <td className={`${TABLE_CELL} font-bold`}>{typeLabelOf(row)}</td>
                        <td className={TABLE_CELL}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <PriorityBadge severity={getEffectivePriority(row) || "critical"} />
                            <IncidentBadge emergency={row} />
                          </div>
                        </td>
                        <td className={`${TABLE_CELL} max-w-[200px] truncate`}>
                          <GeoLabel emergency={row} fallback="Sin dirección" />
                        </td>
                        <td className={TABLE_CELL}>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className={TABLE_CELL_MONO}>
                          {formatTimeShort(closedAtOf(row))}
                        </td>
                        <td className={TABLE_CELL}>{officerLabel(row)}</td>
                        <td className={`${TABLE_CELL} max-w-[260px] truncate`}>
                          {getEmergencyReason(row) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden flex flex-col gap-2.5 w-full">
                {displayedItems.map((row) => (
                  <div
                    key={row.id}
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
                  >
                    <EmergencyMobileCard
                      badges={
                        <>
                          <PriorityBadge severity={getEffectivePriority(row) || "critical"} />
                          <StatusBadge status={row.status} />
                          <IncidentBadge emergency={row} />
                        </>
                      }
                      location={<GeoLabel emergency={row} fallback="Sin dirección" />}
                      extraRows={[
                        { icon: "category",    label: "Tipo",                  value: typeLabelOf(row) },
                        { icon: "badge",       label: "Oficial interviniente", value: officerLabel(row) },
                        { icon: "description", label: "Motivo",                value: getEmergencyReason(row) || "—" },
                      ]}
                      idLabel={`#${row.id?.slice(0, 8)}`}
                      timeLabel={formatTimeShort(closedAtOf(row))}
                      selected={selected?.id === row.id}
                      onClick={() => handleSelect(row)}
                    />
                  </div>
                ))}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={`${BTN_BASE} ${BTN_SECONDARY} self-center px-6 py-2 mt-1`}
                >
                  {loadingMore ? "Cargando…" : "Cargar más"}
                </button>
              )}
            </div>

            {/* Detalle: bottom sheet en mobile/tablet, panel lateral docked en
                desktop (mismo componente que /ops/lista). */}
            <EmergencyDetailPanel open={Boolean(selected)} onClose={() => setSelected(null)}>
              {renderDetailPanelBody()}
            </EmergencyDetailPanel>
          </div>
        )}
      </main>
    </>
  );
}
