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
