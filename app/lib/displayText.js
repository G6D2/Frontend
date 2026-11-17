import { SEVERITY_CONFIG } from "./emergencies";
import { getEmergencyOrigin } from "./emergencyOrigin";

/**
 * Textos para mostrar que el backend guarda en inglés o con ids internos.
 *
 * El backend escribe en el historial "Assigned officer of-001" al asignar. El
 * ciudadano no tiene por qué ver ni el inglés ni el id del oficial: se muestra
 * en castellano y sin el id. Los motivos que escribe una persona (por ejemplo
 * el de una cancelación) quedan como están.
 */
const ASSIGNED_OFFICER = /^Assigned officer\s+\S+$/i;

export function formatHistoryReason(reason) {
  if (typeof reason !== "string") return "";
  const text = reason.trim();
  if (!text) return "";
  if (ASSIGNED_OFFICER.test(text)) return "Se asignó un oficial";
  return text;
}

/**
 * Quién hizo cada cambio del historial, para las vistas del dispatcher
 * (auditoría, issue demo-repository#28). El ciudadano no lo ve: trae ids de
 * personal.
 *
 * El backend guarda en `actor` el `sub` del token de quien hizo el cambio, o un
 * actor fijo cuando lo hizo otro módulo o un job. El `sub` solo no dice el rol,
 * pero la transición sí: el backend habilita cada una para un solo rol.
 * - Validar, devolver, descartar, asignar y cerrar: el dispatcher.
 * - En camino, en el lugar y resuelta: el oficial asignado. Su `sub` es el id
 *   del catálogo (`of-001`), así que se muestra con el nombre si está.
 * - Cancelar: el ciudadano dueño. Los otros módulos y el job de expiración
 *   también cancelan, pero con su actor fijo.
 */
const SYSTEM_ACTORS = {
  "eda:reclamos": "Reclamos (automático)",
  "eda:espacios": "Espacios (automático)",
  "sistema:expiracion": "Expiración automática",
};
const DISPATCHER_STATUSES = new Set(["VALIDATED", "DISCARDED", "DISPATCHED", "CLOSED"]);
const OFFICER_STATUSES = new Set(["EN_ROUTE", "ON_SCENE", "RESOLVED"]);

function officerActorLabel(officerId, officers) {
  const found = Array.isArray(officers) ? officers.find((o) => o?.id === officerId) : null;
  const name = typeof found?.name === "string" ? found.name.trim() : "";
  if (!name) return `Oficial (${officerId})`;
  // El catálogo ya trae "Oficial Carlos Gómez".
  return /^oficial\s/i.test(name) ? name : `Oficial ${name}`;
}

/**
 * Etiqueta del actor de una entrada de `statusHistory` ({ actor, newStatus }).
 * `officers` es el catálogo ([{ id, name }]) para mostrar al oficial por su
 * nombre. Sin actor, cadena vacía; un actor que no se reconoce, tal cual.
 */
export function formatHistoryActor(entry, officers = []) {
  const actor = typeof entry?.actor === "string" ? entry.actor.trim() : "";
  if (!actor) return "";
  if (SYSTEM_ACTORS[actor]) return SYSTEM_ACTORS[actor];
  const status = String(entry.newStatus || "").toUpperCase();
  if (OFFICER_STATUSES.has(status)) return officerActorLabel(actor, officers);
  if (DISPATCHER_STATUSES.has(status)) return `Dispatcher (${actor})`;
  if (status === "CANCELLED") return "Ciudadano";
  return actor;
}

/** "high" → "Alta". Un valor desconocido se muestra tal cual; vacío, "—". */
export function severityLabel(severity) {
  if (!severity) return "—";
  return SEVERITY_CONFIG[String(severity).toLowerCase()]?.label || String(severity);
}

/**
 * Quién reportó, para la columna "Usuario" de la lista: el usuario si lo hay;
 * si la emergencia la creó otro módulo, su origen ("Reclamo ciclovía",
 * "Cobertura: evento"…); si no, "—".
 */
export function reporterLabel(emergency) {
  if (!emergency) return "—";
  if (emergency.userId) return emergency.userId;
  return getEmergencyOrigin(emergency)?.shortLabel || "—";
}
