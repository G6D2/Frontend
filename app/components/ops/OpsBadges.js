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

/**
 * Único fallback para una emergencia sin prioridad reconocida (severity null
 * o desconocida). Antes cada vista caía en otra: CRÍTICA en la lista, el mapa
 * y asignar, MEDIA en el kanban.
 */
export const NO_PRIORITY_LABEL = "Sin prioridad";

const NO_PRIORITY_PILL = {
  key: null,
  label: NO_PRIORITY_LABEL.toUpperCase(),
  badgeClass: "bg-gray-100 text-gray-700",
};

/** Config de la pill de prioridad: PRIORITY_CONFIG o el fallback gris. */
export function getPriorityPill(severity) {
  return PRIORITY_CONFIG[severity] || NO_PRIORITY_PILL;
}

export function PriorityBadge({ severity }) {
  const cfg = getPriorityPill(severity);
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

// El backend solo usa disponible | ocupado (CHECK de la migración V11).
// Cualquier otro valor no se puede asignar, así que se muestra como
// "No disponible" en vez del valor crudo.
const OFFICER_STATUS_LABELS = {
  disponible: "Disponible",
  ocupado: "Ocupado",
  no_disponible: "No disponible",
};

export function officerStatusLabel(status) {
  return OFFICER_STATUS_LABELS[status] || OFFICER_STATUS_LABELS.no_disponible;
}

/** Pill de disponibilidad de oficiales (no es un estado de emergencia). */
export function OfficerStatusBadge({ status }) {
  const cls =
    OFFICER_STATUS_BADGE_CLASS[status] || OFFICER_STATUS_BADGE_CLASS.no_disponible;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${cls}`}
    >
      {officerStatusLabel(status)}
    </span>
  );
}
