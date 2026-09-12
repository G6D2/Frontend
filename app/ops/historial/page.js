"use client";

import MaterialIcon from "../../components/civic/MaterialIcon";
import { formatTimeShort } from "../../lib/emergencies";
import PageHeader from "../../components/PageHeader";
import { PriorityBadge, StatusBadge } from "../../components/ops/OpsBadges";
import EmergencyMobileCard from "../../components/ops/EmergencyMobileCard";
import {
  TABLE_CONTAINER,
  TABLE_HEAD,
  TABLE_TH,
  TABLE_BODY,
  TABLE_ROW,
  TABLE_CELL,
  TABLE_CELL_MONO,
} from "../../components/ops/tableStyles";

// TODO(back): HU-07 — GET emergencias CERRADA/CANCELLED/DISCARDED (no mock)
// Único array de datos para las dos variantes (tabla desktop y tarjetas
// mobile): antes cada una mostraba un subconjunto de campos distinto
// (desktop no tenía severidad/oficial/motivo, mobile los escondía detrás de
// un acordeón). Ahora las dos muestran exactamente los mismos campos.
// Estados en el formato canónico del backend (RESOLVED/DISCARDED) para que
// StatusBadge (app/components/ops/OpsBadges.js, mismo componente que usan
// /ops/lista y /ops/oficiales) resuelva el label y color correctos.
const HISTORY = [
  {
    id: "em-h01",
    type: "Médica",
    severity: "high",
    location: "Villa Crespo",
    status: "RESOLVED",
    time: "2026-08-28T18:00:00-03:00",
    resolution: "Atendido por SAME Móvil 12. Paciente trasladado estable.",
    assignedOfficer: "Oficial García (Placa 4402)",
  },
  {
    id: "em-h02",
    type: "Incendio",
    severity: "critical",
    location: "San Telmo",
    status: "RESOLVED",
    time: "2026-08-27T09:30:00-03:00",
    resolution: "Principio de incendio controlado por Bomberos de la Ciudad.",
    assignedOfficer: "Bomberos Cuartel Central",
  },
  {
    id: "em-h03",
    type: "Disturbio",
    severity: "low",
    location: "La Boca",
    status: "DISCARDED",
    time: "2026-08-26T22:15:00-03:00",
    resolution: "Falsa alarma o resuelto previo al arribo policial.",
    assignedOfficer: "Comisaría Vecinal 4C",
  },
];

const DESKTOP_COLUMNS = [
  "ID",
  "Tipo",
  "Prioridad",
  "Ubicación",
  "Estado",
  "Hora",
  "Oficial",
  "Motivo",
];

export default function HistorialPage() {
  return (
    <>
      <PageHeader title="Historial" />
      <main className="p-3 sm:p-4 w-full flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
          <MaterialIcon name="info" size={18} className="shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-medium">
            Datos de ejemplo: el historial real se conecta en la próxima
            iteración.
          </p>
        </div>

        {/* Desktop / Tablet: misma tabla que /ops/lista (header en
            mayúsculas con tracking sobre surface-container, alto de fila,
            bordes, hover y tipografía mono para id/hora), con todas las
            columnas que hoy muestran las tarjetas mobile. */}
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
              {HISTORY.map((row) => (
                <tr key={row.id} className={TABLE_ROW}>
                  <td className={TABLE_CELL_MONO}>{row.id}</td>
                  <td className={`${TABLE_CELL} font-bold`}>{row.type}</td>
                  <td className={TABLE_CELL}>
                    <PriorityBadge severity={row.severity} />
                  </td>
                  <td className={TABLE_CELL}>{row.location}</td>
                  <td className={TABLE_CELL}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={TABLE_CELL_MONO}>
                    {formatTimeShort(row.time)}
                  </td>
                  <td className={TABLE_CELL}>{row.assignedOfficer || "—"}</td>
                  <td className={`${TABLE_CELL} max-w-[260px]`}>
                    {row.resolution || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: mismo componente de tarjeta que /ops/lista
            (EmergencyMobileCard, con las mismas pills PriorityBadge/
            StatusBadge), con filas extra para tipo/oficial/motivo — sin
            acordeón, para mostrar exactamente los mismos datos que la
            tabla de escritorio. */}
        <div className="sm:hidden flex flex-col gap-2.5 w-full">
          {HISTORY.map((row) => (
            <div
              key={row.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
            >
              <EmergencyMobileCard
                badges={
                  <>
                    <PriorityBadge severity={row.severity} />
                    <StatusBadge status={row.status} />
                  </>
                }
                location={row.location}
                extraRows={[
                  { icon: "category", label: "Tipo", value: row.type },
                  ...(row.assignedOfficer
                    ? [
                        {
                          icon: "badge",
                          label: "Oficial interviniente",
                          value: row.assignedOfficer,
                        },
                      ]
                    : []),
                  ...(row.resolution
                    ? [
                        {
                          icon: "description",
                          label: "Motivo / resolución",
                          value: row.resolution,
                        },
                      ]
                    : []),
                ]}
                idLabel={`#${row.id}`}
                timeLabel={formatTimeShort(row.time)}
              />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
