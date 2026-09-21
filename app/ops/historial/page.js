"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

// Estados terminales que muestra el historial (issue #46). RESOLVED se
// incluye por si el backend llega a usarlo como paso previo a CLOSED — hoy
// (2026-09) las transiciones reales cierran vía CLOSED/CANCELLED/DISCARDED.
const TERMINAL_STATUSES = ["CLOSED", "CANCELLED", "DISCARDED", "RESOLVED"];
const PAGE_SIZE = 20;

// Pills de filtro: cada una manda su propio subconjunto de estados al
// backend (status=A,B,C en una sola llamada — el controller acepta varios
// separados por coma, ver src/controllers/emergency.controller.js). "Cerradas"
// agrupa CLOSED y RESOLVED porque ambas representan una emergencia atendida.
const STATUS_FILTERS = [
  { key: "all", label: "Todas", statuses: TERMINAL_STATUSES },
  { key: "closed", label: "Cerradas", statuses: ["CLOSED", "RESOLVED"] },
  { key: "cancelled", label: "Canceladas", statuses: ["CANCELLED"] },
  { key: "discarded", label: "Descartadas", statuses: ["DISCARDED"] },
];

const DESKTOP_COLUMNS = [
  "ID",
  "Tipo",
  "Prioridad",
  "Ubicación",
  "Estado",
  "Cierre",
  "Oficial",
  "Motivo",
];

function typeLabel(emergency) {
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

/** Ordena por hora de cierre (closedAt, o updatedAt si no hay) desc. */
function sortByClosedDesc(list) {
  return [...list].sort((a, b) => {
    const ta = new Date(closedAtOf(a) || 0).getTime();
    const tb = new Date(closedAtOf(b) || 0).getTime();
    return tb - ta;
  });
}

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

export default function HistorialPage() {
  const router = useRouter();
  const [filterKey, setFilterKey] = useState("all");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const requestSeqRef = useRef(0);

  const load = useCallback(async (key, pageToLoad, { append = false } = {}) => {
    const filter = STATUS_FILTERS.find((f) => f.key === key) || STATUS_FILTERS[0];
    const seq = ++requestSeqRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const { data, pagination: nextPagination } = await fetchEmergenciesPage({
        status: filter.statuses.join(","),
        page: pageToLoad,
        limit: PAGE_SIZE,
      });
      if (seq !== requestSeqRef.current) return;
      setItems((prev) => sortByClosedDesc(append ? [...prev, ...data] : data));
      setPagination(nextPagination);
      setPage(pageToLoad);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(
        err instanceof ApiError ? err.message : "No se pudo cargar el historial"
      );
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
        if (!isDispatcher(user)) {
          router.replace("/inicio");
          return;
        }
        if (!cancelled) await load(filterKey, 1);
      } catch {
        router.replace("/acceso");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo se re-ejecuta cuando cambia el filtro: el guard de sesión no
    // necesita repetirse en cada cambio de pill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  function handleFilterChange(key) {
    if (key === filterKey) return;
    setSelected(null);
    setFilterKey(key);
  }

  function handleRetry() {
    load(filterKey, 1);
  }

  function handleLoadMore() {
    if (loadingMore || !pagination) return;
    if (page >= pagination.totalPages) return;
    load(filterKey, page + 1, { append: true });
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

  const hasMore = Boolean(pagination && page < pagination.totalPages);

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
            <MaterialIcon
              name="location_on"
              className="text-on-surface-variant mt-0.5 shrink-0"
            />
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
              <span className="font-medium text-on-surface text-right">
                {typeLabel(selected)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Oficial:</span>
              <span className="font-medium text-on-surface text-right">
                {officerLabel(selected)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Hora de cierre:</span>
              <span className="font-mono font-medium text-on-surface">
                {formatTimeShort(closedAtOf(selected))}
              </span>
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
        {/* Pills de filtro por estado */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => handleFilterChange(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                filterKey === f.key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

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

        {items.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 relative items-start">
          <div className="flex-1 flex flex-col gap-3 sm:gap-4 min-w-0 w-full">
            {/* Desktop / Tablet */}
            <div className={`hidden sm:block ${TABLE_CONTAINER}`}>
              <table className="w-full text-left border-collapse">
                <thead className={TABLE_HEAD}>
                  <tr>
                    {DESKTOP_COLUMNS.map((h) => (
                      <th key={h} className={TABLE_TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {items.map((row) => (
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
                      <td className={`${TABLE_CELL} font-bold`}>{typeLabel(row)}</td>
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
              {items.map((row) => (
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
                      { icon: "category", label: "Tipo", value: typeLabel(row) },
                      { icon: "badge", label: "Oficial interviniente", value: officerLabel(row) },
                      {
                        icon: "description",
                        label: "Motivo",
                        value: getEmergencyReason(row) || "—",
                      },
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
