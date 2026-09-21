import { PRIORITY_CONFIG, getStatusConfig } from "../../lib/emergencies";

/**
 * Pills de prioridad y estado compartidas por /ops/lista, /ops/historial y
 * /ops/oficiales (mismo patrón Tailwind `bg-*-100 text-*-800` que ya usaba
 * /ops/lista). /ops/historial y /ops/oficiales usaban antes `color-mix()`
 * sobre variables `--color-status-*`, con contraste bajo en los estados
 * terminales; ahora comparten este único componente.
 *
 * El kanban Mantine (DispatcherView/EmergencyCard) sigue usando `Badge` de
 * Mantine con el color de SEVERITY_CONFIG — misma fuente de verdad de datos,
 * pero visualmente distinto porque migrarlo a Tailwind implica sacar Mantine
 * de esos componentes; ese refactor queda con el resto de la deuda técnica
 * del tablero duplicado (ver PR).
 */
export function PriorityBadge({ severity }) {
  const cfg = PRIORITY_CONFIG[severity] || PRIORITY_CONFIG.medium;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${cfg.badgeClass}`}
    >
      {cfg.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${cfg.badgeClass}`}
    >
      {cfg.label}
    </span>
  );
}

const OFFICER_STATUS_BADGE_CLASS = {
  disponible: "bg-green-100 text-green-800",
  ocupado: "bg-amber-100 text-amber-900",
  no_disponible: "bg-gray-100 text-gray-700",
};

/** Pill de disponibilidad de oficiales (no es un estado de emergencia). */
export function OfficerStatusBadge({ status }) {
  const cls = OFFICER_STATUS_BADGE_CLASS[status] || "bg-amber-100 text-amber-900";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${cls}`}
    >
      {(status || "—").replace(/_/g, " ")}
    </span>
  );
}
