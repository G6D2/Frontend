import MaterialIcon from "../civic/MaterialIcon";
import {
  getIncidentSummary,
  isPriorityElevatedByIncident,
  translateIncidentReasonCode,
  PRIORITY_CONFIG,
} from "../../lib/emergencies";

/**
 * Pill "Incidente · N reportes" para filas/tarjetas/popups que agrupan
 * varios reportes en un único incidente (Risk Engine, contrato 2026-09: PR
 * en curso en emergencias-backend, todavía NO en producción). Null-safe: no
 * renderiza nada si la emergencia no tiene incidente asociado o el backend
 * todavía no manda el campo `incident`.
 */
export function IncidentBadge({ emergency, className = "" }) {
  const incident = getIncidentSummary(emergency);
  if (!incident || !incident.reportCount) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 bg-purple-100 text-purple-800 ${className}`}
    >
      <MaterialIcon name="hub" size={12} />
      Incidente · {incident.reportCount}{" "}
      {incident.reportCount === 1 ? "reporte" : "reportes"}
    </span>
  );
}

/**
 * Bloque "Incidente detectado" para el panel de detalle (/ops/lista,
 * /ops/asignar): reportes agrupados, ciudadanos únicos, score y los
 * reasonCodes traducidos a español. Si la prioridad efectiva quedó por
 * encima de la severity original, aclara "Prioridad elevada por incidente
 * (era Media)". Null-safe: no renderiza nada sin incidente.
 */
export function IncidentDetailBlock({ emergency }) {
  const incident = getIncidentSummary(emergency);
  if (!incident) return null;

  const elevated = isPriorityElevatedByIncident(emergency);
  const originalLabel = PRIORITY_CONFIG[emergency?.severity]?.label;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-purple-900">
        <MaterialIcon name="hub" size={16} />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          Incidente detectado
        </span>
      </div>

      {elevated && originalLabel && (
        <p className="text-xs font-bold text-purple-900">
          Prioridad elevada por incidente (era {originalLabel})
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 text-purple-900">
        <div>
          <span className="block text-[10px] uppercase font-bold text-purple-700 tracking-wider">
            Reportes
          </span>
          <span className="text-sm font-bold">{incident.reportCount ?? "—"}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-purple-700 tracking-wider">
            Ciudadanos únicos
          </span>
          <span className="text-sm font-bold">
            {incident.uniqueCitizens ?? "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-purple-700 tracking-wider">
            Score
          </span>
          <span className="text-sm font-bold">{incident.score ?? "—"}</span>
        </div>
      </div>

      {incident.reasonCodes.length > 0 && (
        <div>
          <span className="block text-[10px] uppercase font-bold text-purple-700 tracking-wider mb-1">
            Motivos
          </span>
          <ul className="list-disc list-inside text-xs text-purple-900 flex flex-col gap-0.5">
            {incident.reasonCodes.map((code) => (
              <li key={code}>{translateIncidentReasonCode(code)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
