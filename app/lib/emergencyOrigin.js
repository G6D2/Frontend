/**
 * Origen de las emergencias externas (issue #83 del board): las que crea el
 * backend a partir de un evento de otro módulo, no un ciudadano.
 *
 * El backend las manda con `source: "EXTERNAL"` y la causa en `causaTipo`
 * (CHECK de V23/V32 en emergencias-backend):
 *   - RECLAMO: intervención por un reclamo de ciclovía obstruida.
 *   - EVENTO_PUBLICO: cobertura preventiva por un evento comunitario o una
 *     actividad de Espacios (el backend no distingue cuál).
 *   - RESERVA: cobertura preventiva por una reserva grande de un espacio.
 *   - EVENTO_CLIMATICO: alerta climática de Espacios.
 *   - MOVILIDAD_BICICLETA: pedido de asistencia durante un viaje en bicicleta
 *     pública.
 *   - INCIDENTE_VIAL: está en el catálogo del backend, pero todavía ningún
 *     listener lo crea.
 *
 * Solo se muestra de dónde viene. El id de la causa en el otro módulo
 * (`causaId`) no se muestra: el dispatcher trabaja con un solo identificador,
 * el de la emergencia.
 *
 * `label` va en la tarjeta del tablero y en el detalle; `shortLabel`, en las
 * pills de las listas.
 */
const ORIGINS = {
  RECLAMO: { label: "Reclamo de ciclovía", shortLabel: "Reclamo ciclovía", icon: "pedal_bike" },
  EVENTO_PUBLICO: { label: "Cobertura preventiva por evento", shortLabel: "Cobertura: evento", icon: "groups" },
  RESERVA: { label: "Cobertura preventiva por reserva", shortLabel: "Cobertura: reserva", icon: "event_available" },
  EVENTO_CLIMATICO: { label: "Alerta climática", shortLabel: "Alerta climática", icon: "thunderstorm" },
  MOVILIDAD_BICICLETA: { label: "Asistencia en bici", shortLabel: "Asistencia en bici", icon: "directions_bike" },
  INCIDENTE_VIAL: { label: "Incidente vial", shortLabel: "Incidente vial", icon: "car_crash" },
};

/** Externa con una causa que el front todavía no conoce (o sin causa). */
const UNKNOWN_EXTERNAL_ORIGIN = { label: "Origen externo", shortLabel: "Externa", icon: "call_received" };

/**
 * Origen de una emergencia externa, o null si la reportó un ciudadano (sin
 * `causaTipo` y con `source` INTERNAL o sin source).
 *
 * @returns {null | { tipo: string|null, label: string, shortLabel: string, icon: string }}
 */
export function getEmergencyOrigin(emergency) {
  if (!emergency) return null;
  const tipo =
    typeof emergency.causaTipo === "string" && emergency.causaTipo.trim()
      ? emergency.causaTipo.trim()
      : null;
  if (!tipo && emergency.source !== "EXTERNAL") return null;

  const config = (tipo && ORIGINS[tipo]) || UNKNOWN_EXTERNAL_ORIGIN;
  return { tipo, ...config };
}
