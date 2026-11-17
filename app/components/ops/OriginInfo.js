import MaterialIcon from "../civic/MaterialIcon";
import { getEmergencyOrigin } from "../../lib/emergencyOrigin";

/**
 * Pill con el origen de una emergencia externa (reclamo de ciclovía,
 * cobertura preventiva, alerta climática, asistencia en bici) para las filas
 * y tarjetas de las listas. No renderiza nada en las que reportó un
 * ciudadano.
 */
export function OriginBadge({ emergency, className = "" }) {
  const origin = getEmergencyOrigin(emergency);
  if (!origin) return null;
  return (
    <span
      title={origin.label}
      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap bg-sky-100 text-sky-900 ${className}`}
    >
      <MaterialIcon name={origin.icon} size={12} />
      {origin.shortLabel}
    </span>
  );
}

/**
 * Bloque "Origen" para los paneles de detalle: de dónde viene la emergencia.
 * No renderiza nada en las que reportó un ciudadano.
 */
export function OriginNotice({ emergency }) {
  const origin = getEmergencyOrigin(emergency);
  if (!origin) return null;
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-start gap-2 text-sky-900">
      <MaterialIcon name={origin.icon} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wider block">Origen</span>
        <span className="text-xs font-bold block">{origin.label}</span>
      </div>
    </div>
  );
}
