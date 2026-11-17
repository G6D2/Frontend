"use client";

import { useEffect, useState } from "react";
import { fetchEmergencyHistory, fetchOfficers } from "../../lib/api";
import { formatTime, formatTimeShort, getStatusConfig } from "../../lib/emergencies";
import { formatHistoryActor, formatHistoryReason } from "../../lib/displayText";

/**
 * Historial de estados en el panel de detalle del dispatcher (/ops/lista y
 * /ops/historial), con quién hizo cada cambio (auditoría, issue
 * demo-repository#28). La vista del ciudadano tiene su propio historial, sin
 * el actor: no debe ver ids de personal.
 */

// El catálogo de oficiales se pide una vez por pestaña: el panel se monta dos
// veces (bottom sheet y lateral) y cambia de emergencia seguido. Si falla, los
// oficiales se muestran por su id y se reintenta en el próximo montaje.
let officerCatalog = null;

function loadOfficerCatalog() {
  if (!officerCatalog) {
    officerCatalog = fetchOfficers().catch(() => {
      officerCatalog = null;
      return [];
    });
  }
  return officerCatalog;
}

function useOfficerCatalog() {
  const [officers, setOfficers] = useState([]);
  useEffect(() => {
    let cancelled = false;
    loadOfficerCatalog().then((list) => {
      if (!cancelled) setOfficers(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return officers;
}

/**
 * statusHistory de la emergencia seleccionada, para las vistas cuyo listado no
 * lo trae. Se vuelve a pedir al cambiar de emergencia o de estado (no en cada
 * poll: cada GET del detalle queda en la auditoría de accesos del backend).
 * Devuelve undefined mientras carga la primera vez y null si falló.
 */
export function useEmergencyHistory(emergencyId, status) {
  const [state, setState] = useState({ id: null, entries: undefined });
  const key = emergencyId ? `${emergencyId}:${status}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    fetchEmergencyHistory(emergencyId).then(
      (entries) => {
        if (!cancelled) setState({ id: emergencyId, entries });
      },
      () => {
        // Si ya había un historial de esta emergencia, se queda el anterior.
        if (!cancelled) {
          setState((prev) => ({
            id: emergencyId,
            entries: prev.id === emergencyId && prev.entries ? prev.entries : null,
          }));
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [emergencyId, key]);

  return state.id === emergencyId ? state.entries : undefined;
}

/** "Hoy · 14:32", "Ayer · 09:10" o "12 nov · 18:05". */
function entryTime(iso) {
  if (!iso) return "—";
  const day = formatTime(iso);
  return day.includes("·") ? day : `${day} · ${formatTimeShort(iso)}`;
}

/**
 * @param {{ history: Array|null|undefined, emergency?: object }} props
 *   history: el statusHistory del detalle; undefined mientras carga y null si
 *   no se pudo traer. emergency: para nombrar al oficial asignado aunque el
 *   catálogo no cargue.
 */
export default function StatusHistory({ history, emergency }) {
  const catalog = useOfficerCatalog();
  const assigned =
    emergency?.assignedOfficerId && typeof emergency.assignedOfficer === "string"
      ? [{ id: emergency.assignedOfficerId, name: emergency.assignedOfficer }]
      : [];
  const officers = [...assigned, ...catalog];

  let body;
  if (history === undefined) {
    body = <p className="text-xs text-on-surface-variant">Cargando historial…</p>;
  } else if (!Array.isArray(history)) {
    body = <p className="text-xs text-on-surface-variant">No se pudo cargar el historial.</p>;
  } else if (history.length === 0) {
    body = <p className="text-xs text-on-surface-variant">Sin cambios de estado todavía.</p>;
  } else {
    body = (
      <ol className="flex flex-col">
        {history.map((entry, index) => {
          const reason = formatHistoryReason(entry.reason);
          const actor = formatHistoryActor(entry, officers);
          return (
            <li
              key={`${entry.id || index}-${entry.newStatus}`}
              data-testid="history-entry"
              className="flex gap-2.5 text-xs"
            >
              <div className="flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                {index < history.length - 1 && <span className="flex-1 w-px bg-outline-variant my-1" />}
              </div>
              <div className={`min-w-0 flex-1 ${index < history.length - 1 ? "pb-3" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-on-surface">{getStatusConfig(entry.newStatus).label}</span>
                  <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
                    {entryTime(entry.createdAt)}
                  </span>
                </div>
                {reason && <div className="text-on-surface-variant wrap-anywhere">{reason}</div>}
                {actor && (
                  <div className="text-on-surface-variant wrap-anywhere">
                    Por <span className="font-medium text-on-surface">{actor}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="border-t border-outline-variant/40 pt-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-2">
        Historial de cambios
      </span>
      {body}
    </div>
  );
}
