/**
 * Origen de las emergencias externas (issue #83 del board): las que crea el
 * backend a partir de un evento de otro módulo, no un ciudadano.
 *
 * El backend las manda con `source: "EXTERNAL"` y la causa en `causaTipo` +
 * `causaId` (los dos o ninguno, CHECK de V23/V32 en emergencias-backend):
 *   - RECLAMO: intervención por un reclamo de ciclovía obstruida (causaId =
 *     reclamoId de Reclamos).
 *   - EVENTO_PUBLICO: cobertura preventiva por un evento comunitario o una
 *     actividad de Espacios (causaId = eventoId o actividadId; el backend no
 *     distingue cuál).
 *   - RESERVA: cobertura preventiva por una reserva grande de un espacio.
 *   - EVENTO_CLIMATICO: alerta climática de Espacios (causaId = alertaId).
 *   - MOVILIDAD_BICICLETA: pedido de asistencia durante un viaje en bicicleta
 *     pública (causaId = emergenciaId de Movilidad, p. ej. EMG-20261115-12345).
 *   - INCIDENTE_VIAL: está en el catálogo del backend, pero todavía ningún
 *     listener lo crea.
 *
 * `label` es el texto completo (tarjeta del tablero y detalle), `shortLabel`
 * entra en una pill y `referenceLabel` antecede al id corto de la causa
 * ("Reclamo 00b4bea5").
 */
const ORIGINS = {
  RECLAMO: {
    label: "Reclamo de ciclovía",
    shortLabel: "Reclamo ciclovía",
    referenceLabel: "Reclamo",
    icon: "pedal_bike",
  },
  EVENTO_PUBLICO: {
    label: "Cobertura preventiva por evento o actividad",
    shortLabel: "Cobertura: evento",
    referenceLabel: "Evento/actividad",
    icon: "groups",
  },
  RESERVA: {
    label: "Cobertura preventiva por reserva de espacio",
    shortLabel: "Cobertura: reserva",
    referenceLabel: "Reserva",
    icon: "event_available",
  },
  EVENTO_CLIMATICO: {
    label: "Alerta climática",
    shortLabel: "Alerta climática",
    referenceLabel: "Alerta",
    icon: "thunderstorm",
  },
  MOVILIDAD_BICICLETA: {
    label: "Pedido de asistencia en bici",
    shortLabel: "Asistencia en bici",
    referenceLabel: "Pedido",
    icon: "directions_bike",
  },
  INCIDENTE_VIAL: {
    label: "Incidente vial",
    shortLabel: "Incidente vial",
    referenceLabel: "Incidente",
    icon: "car_crash",
  },
};

/** Externa con una causa que el front todavía no conoce (o sin causa). */
const UNKNOWN_EXTERNAL_ORIGIN = {
  label: "Origen externo",
  shortLabel: "Externa",
  referenceLabel: "Referencia",
  icon: "call_received",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SHORT_ID_LENGTH = 20;

/**
 * Id corto de la causa para mostrar: los 8 primeros caracteres de un UUID
 * (como el id de la emergencia en el tablero) y el id completo si no es un
 * UUID (EMG-20261115-12345, res-700), cortado con "…" si es muy largo.
 */
export function shortCausaId(causaId) {
  const id = String(causaId ?? "").trim();
  if (UUID_PATTERN.test(id)) return id.slice(0, 8).toLowerCase();
  if (id.length <= MAX_SHORT_ID_LENGTH) return id;
  return `${id.slice(0, MAX_SHORT_ID_LENGTH - 1)}…`;
}

/**
 * Origen normalizado de una emergencia externa, o null si la reportó un
 * ciudadano (sin `causaTipo` y con `source` INTERNAL o sin source).
 *
 * @returns {null | { tipo: string|null, label: string, shortLabel: string,
 *   icon: string, causaId: string|null, reference: string|null }}
 */
export function getEmergencyOrigin(emergency) {
  if (!emergency) return null;
  const tipo =
    typeof emergency.causaTipo === "string" && emergency.causaTipo.trim()
      ? emergency.causaTipo.trim()
      : null;
  if (!tipo && emergency.source !== "EXTERNAL") return null;

  const config = (tipo && ORIGINS[tipo]) || UNKNOWN_EXTERNAL_ORIGIN;
  const causaId =
    typeof emergency.causaId === "string" && emergency.causaId.trim()
      ? emergency.causaId.trim()
      : null;

  return {
    tipo,
    label: config.label,
    shortLabel: config.shortLabel,
    icon: config.icon,
    causaId,
    reference: causaId ? `${config.referenceLabel} ${shortCausaId(causaId)}` : null,
  };
}
