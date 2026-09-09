"use client";

import { useState } from "react";
import MaterialIcon from "../../components/civic/MaterialIcon";
import { formatTimeShort } from "../../lib/emergencies";

// TODO(back): HU-07 — GET emergencias CERRADA/CANCELLED/DISCARDED (no mock)
const HISTORY = [
  {
    id: "em-h01",
    type: "Médica",
    icon: "medical_services",
    location: "Villa Crespo",
    status: "resuelta",
    time: "2026-08-28T18:00:00-03:00",
    resolution: "Atendido por SAME Móvil 12. Paciente trasladado estable.",
    assignedOfficer: "Oficial García (Placa 4402)",
  },
  {
    id: "em-h02",
    type: "Incendio",
    icon: "local_fire_department",
    location: "San Telmo",
    status: "resuelta",
    time: "2026-08-27T09:30:00-03:00",
    resolution: "Principio de incendio controlado por Bomberos de la Ciudad.",
    assignedOfficer: "Bomberos Cuartel Central",
  },
  {
    id: "em-h03",
    type: "Disturbio",
    icon: "groups",
    location: "La Boca",
    status: "descartada",
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
    <main className="p-4 sm:p-6 w-full">
      <h1 className="text-xl sm:text-2xl font-bold text-primary mb-6">Historial</h1>

      {/* ── Vista Escritorio / Tablet (Tabla original a pantalla completa) ── */}
      <div className="hidden sm:block w-full">
        <table className="w-full text-left border-collapse bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
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
                <td className="p-3 font-mono">{row.id}</td>
                <td className="p-3 font-bold">{row.type}</td>
                <td className="p-3">{row.location}</td>
                <td className="p-3">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor:
                        row.status === "resuelta"
                          ? "color-mix(in srgb, var(--color-status-validada) 20%, transparent)"
                          : "color-mix(in srgb, var(--color-status-pendiente) 20%, transparent)",
                      color:
                        row.status === "resuelta"
                          ? "var(--color-status-validada)"
                          : "var(--color-status-pendiente)",
                    }}
                  >
                    {row.status}
                  </span>
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
          const isResuelta = row.status === "resuelta";

          return (
            <div
              key={row.id}
              onClick={() => toggleExpand(row.id)}
              className={`w-full bg-surface-container-lowest border rounded-xl transition-all cursor-pointer overflow-hidden ${
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
                    </div>
                    <span className="text-xs text-on-surface-variant truncate block">
                      {row.location}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: isResuelta
                        ? "color-mix(in srgb, var(--color-status-validada) 18%, transparent)"
                        : "color-mix(in srgb, var(--color-status-pendiente) 18%, transparent)",
                      color: isResuelta
                        ? "var(--color-status-validada)"
                        : "var(--color-status-pendiente)",
                    }}
                  >
                    {row.status}
                  </span>
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
  );
}
