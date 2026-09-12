"use client";

import { useState } from "react";
import MaterialIcon from "../../components/civic/MaterialIcon";
import { formatTimeShort } from "../../lib/emergencies";
import PageHeader from "../../components/PageHeader";
import { StatusBadge } from "../../components/ops/OpsBadges";

// TODO(back): HU-07 — GET emergencias CERRADA/CANCELLED/DISCARDED (no mock)
// Estados en el formato canónico del backend (RESOLVED/DISCARDED) para que
// StatusBadge (app/components/ops/OpsBadges.js, mismo componente que usan
// /ops/lista y /ops/oficiales) resuelva el label y color correctos.
const HISTORY = [
  {
    id: "em-h01",
    type: "Médica",
    icon: "medical_services",
    location: "Villa Crespo",
    status: "RESOLVED",
    time: "2026-08-28T18:00:00-03:00",
    resolution: "Atendido por SAME Móvil 12. Paciente trasladado estable.",
    assignedOfficer: "Oficial García (Placa 4402)",
  },
  {
    id: "em-h02",
    type: "Incendio",
    icon: "local_fire_department",
    location: "San Telmo",
    status: "RESOLVED",
    time: "2026-08-27T09:30:00-03:00",
    resolution: "Principio de incendio controlado por Bomberos de la Ciudad.",
    assignedOfficer: "Bomberos Cuartel Central",
  },
  {
    id: "em-h03",
    type: "Disturbio",
    icon: "groups",
    location: "La Boca",
    status: "DISCARDED",
    time: "2026-08-26T22:15:00-03:00",
    resolution: "Falsa alarma o resuelto previo al arribo policial.",
    assignedOfficer: "Comisaría Vecinal 4C",
  },
];

export default function HistorialPage() {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <PageHeader title="Historial" />
      <main className="p-4 sm:p-6 w-full">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
        <MaterialIcon name="info" size={18} className="shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm font-medium">
          Datos de ejemplo: el historial real se conecta en la próxima
          iteración.
        </p>
      </div>

      {/* ── Vista Escritorio / Tablet (Tabla original a pantalla completa) ── */}
      <div className="hidden sm:block w-full">
        <table className="w-full text-left border-collapse bg-surface-container-lowest border border-dashed border-outline-variant rounded overflow-hidden">
          <thead className="bg-surface-container">
            <tr>
              {["ID", "Tipo", "Ubicación", "Estado", "Hora"].map((h) => (
                <th
                  key={h}
                  className="p-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            {HISTORY.map((row) => (
              <tr
                key={row.id}
                className="border-b border-outline-variant/50 hover:bg-surface-container-low"
              >
                <td className="p-3 font-mono">
                  <span className="inline-flex items-center gap-1.5">
                    {row.id}
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                      Ejemplo
                    </span>
                  </span>
                </td>
                <td className="p-3 font-bold">{row.type}</td>
                <td className="p-3">{row.location}</td>
                <td className="p-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="p-3 font-mono">{formatTimeShort(row.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Vista Móvil (Celular: Tarjetas interactivas sin scroll lateral, toque para detalles) ── */}
      <div className="sm:hidden flex flex-col gap-2.5 w-full">
        {HISTORY.map((row) => {
          const isExpanded = expandedId === row.id;

          return (
            <div
              key={row.id}
              onClick={() => toggleExpand(row.id)}
              className={`w-full bg-surface-container-lowest border border-dashed rounded-xl transition-all cursor-pointer overflow-hidden ${
                isExpanded
                  ? "border-primary/40 shadow-md ring-1 ring-primary/20"
                  : "border-outline-variant hover:border-outline active:bg-surface-container-low"
              }`}
            >
              {/* Fila principal compacta */}
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <MaterialIcon name={row.icon || "history"} size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-on-surface truncate">
                        {row.type}
                      </span>
                      <span className="font-mono text-[11px] text-on-surface-variant shrink-0">
                        #{row.id}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 shrink-0">
                        Ejemplo
                      </span>
                    </div>
                    <span className="text-xs text-on-surface-variant truncate block">
                      {row.location}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={row.status} />
                  <div
                    className={`text-on-surface-variant transition-transform duration-200 ${
                      isExpanded ? "rotate-180 text-primary" : ""
                    }`}
                  >
                    <MaterialIcon name="expand_more" size={20} />
                  </div>
                </div>
              </div>

              {/* Detalle desplegable al tocar */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-1 border-t border-outline-variant/40 bg-surface-container-low/40 flex flex-col gap-2.5 text-xs animate-in fade-in duration-150">
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-start gap-1.5">
                      <MaterialIcon
                        name="location_on"
                        size={16}
                        className="text-primary mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                          Ubicación
                        </span>
                        <span className="font-medium text-on-surface">
                          {row.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <MaterialIcon
                        name="schedule"
                        size={16}
                        className="text-primary mt-0.5 shrink-0"
                      />
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                          Hora registrada
                        </span>
                        <span className="font-medium font-mono text-on-surface">
                          {formatTimeShort(row.time)}
                        </span>
                      </div>
                    </div>

                    {row.assignedOfficer && (
                      <div className="flex items-start gap-1.5">
                        <MaterialIcon
                          name="badge"
                          size={16}
                          className="text-primary mt-0.5 shrink-0"
                        />
                        <div>
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                            Oficial interviniente
                          </span>
                          <span className="font-medium text-on-surface">
                            {row.assignedOfficer}
                          </span>
                        </div>
                      </div>
                    )}

                    {row.resolution && (
                      <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-on-surface">
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-0.5">
                          Resolución
                        </span>
                        <p className="leading-relaxed">{row.resolution}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </main>
    </>
  );
}
