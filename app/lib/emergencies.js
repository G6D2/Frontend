import { formatBarrio } from "./barrio";
import { formatFenomeno, formatGravedad } from "./clima";

/**
 * Config de severidad: fuente única de verdad para label + color semántico.
 * La usa el kanban (Mantine `color`, ver EmergencyCard/DispatcherView) y
 * PRIORITY_CONFIG (abajo) deriva de ella las pills de la lista/mapa/asignar,
 * para que "high" y "critical" nunca vuelvan a compartir el mismo label.
 */
export const SEVERITY_CONFIG = {
  low: { key: "low", color: "blue", label: "Baja" },
  medium: { key: "medium", color: "yellow", label: "Media" },
  high: { key: "high", color: "orange", label: "Alta" },
  critical: { key: "critical", color: "red", label: "Crítica" },
};

/** Nombre de variable CSS (--color-priority-*) por color semántico. */
const PRIORITY_CSS_COLOR = {
  blue: "priority-low",
  yellow: "priority-med",
  orange: "priority-high",
  red: "priority-critical",
};

/** Clases Tailwind del pill (fondo -100 + texto -800/900, contraste ≥ 4.5:1). */
const PRIORITY_BADGE_CLASS = {
  blue: "bg-blue-100 text-blue-800",
  yellow: "bg-yellow-100 text-yellow-900",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
};

/**
 * Clases Tailwind ESTÁTICAS (nunca armadas en runtime tipo `bg-${color}`)
 * para el punto/dot de severidad de las tarjetas y el popup del mapa
 * (/ops/mapa) y para resaltar texto (ej. "Transcurrido" en /ops/lista).
 *
 * Antes ambos usos armaban `var(--color-${cfg.color})` con el nombre de la
 * variable CSS en runtime. Tailwind v4 solo emite a `:root` las variables de
 * `@theme` que puede ver referenciadas como clase literal en el código
 * fuente; `--color-priority-critical` se salvaba porque en otro lado se usa
 * como clase literal (`border-priority-critical`, `bg-priority-critical` en
 * /ops/lista), pero `--color-priority-high/-med/-low` nunca se usaban como
 * clase y quedaban afuera del CSS compilado (confirmado con
 * `npm run build`: solo `--color-priority-critical` aparece en el bundle).
 * Resultado: el punto/texto de severidad "high" (bug real: emergencia
 * "prueba severidad derivada") quedaba sin color, transparente sobre blanco.
 */
const PRIORITY_DOT_CLASS = {
  blue: "bg-blue-500 border border-blue-700",
  yellow: "bg-amber-500 border border-amber-700",
  orange: "bg-orange-500 border border-orange-700",
  red: "bg-red-600 border border-red-800",
};
const PRIORITY_TEXT_CLASS = {
  blue: "text-blue-700",
  yellow: "text-amber-700",
  orange: "text-orange-700",
  red: "text-red-700",
};
const PRIORITY_DOT_FALLBACK = "bg-gray-400 border border-gray-600";
const PRIORITY_TEXT_FALLBACK = "text-gray-600";

/**
 * Pills de prioridad de /ops/lista, /ops/mapa y /ops/asignar. Derivada de
 * SEVERITY_CONFIG: "critical" → CRÍTICA (roja), "high" → ALTA (naranja).
 */
export const PRIORITY_CONFIG = Object.fromEntries(
  Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => [
    key,
    {
      key: cfg.key,
      label: cfg.label.toUpperCase(),
      color: PRIORITY_CSS_COLOR[cfg.color],
      badgeClass: PRIORITY_BADGE_CLASS[cfg.color],
      dotClass: PRIORITY_DOT_CLASS[cfg.color] || PRIORITY_DOT_FALLBACK,
      textClass: PRIORITY_TEXT_CLASS[cfg.color] || PRIORITY_TEXT_FALLBACK,
    },
  ])
);

/** Clase Tailwind estática del punto de color de severidad (fallback gris
 * para severidades desconocidas: nunca invisible). */
export function priorityDotClass(severity) {
  return PRIORITY_CONFIG[severity]?.dotClass || PRIORITY_DOT_FALLBACK;
}

/** Clase Tailwind estática de texto de severidad (mismo criterio que arriba). */
export function priorityTextClass(severity) {
  return PRIORITY_CONFIG[severity]?.textClass || PRIORITY_TEXT_FALLBACK;
}

/**
 * Clases Tailwind para el badge de cada estado: fondo sólido tenue + texto
 * oscuro del mismo tono (contraste ≥ 4.5:1). "terminal" agrupa los estados
 * que ya no tienen actividad (cancelada/cerrada/descartada).
 */
const BADGE_CLASS = {
  pendiente: "bg-amber-100 text-amber-900",
  validada: "bg-green-100 text-green-800",
  despachada: "bg-blue-100 text-blue-800",
  terminal: "bg-gray-100 text-gray-700",
};

/** Estados del backend (CREATED, CANCELLED, VALIDATED, …) → UI */
export const STATUS_CONFIG = {
  CREATED: { label: "PENDIENTE", color: "status-pendiente", key: "pendiente", badgeClass: BADGE_CLASS.pendiente },
  PENDING: { label: "PENDIENTE", color: "status-pendiente", key: "pendiente", badgeClass: BADGE_CLASS.pendiente },
  VALIDATED: { label: "VALIDADA", color: "status-validada", key: "validada", badgeClass: BADGE_CLASS.validada },
  CANCELLED: { label: "CANCELADA", color: "status-terminal", key: "cancelada", badgeClass: BADGE_CLASS.terminal },
  DISPATCHED: { label: "DESPACHADA", color: "status-despachada", key: "despachada", badgeClass: BADGE_CLASS.despachada },
  EN_ROUTE: { label: "EN CAMINO", color: "status-despachada", key: "en_camino", badgeClass: BADGE_CLASS.despachada },
  ON_SITE: { label: "EN LUGAR", color: "status-validada", key: "en_lugar", badgeClass: BADGE_CLASS.validada },
  ON_SCENE: { label: "EN LUGAR", color: "status-validada", key: "en_lugar", badgeClass: BADGE_CLASS.validada },
  RESOLVED: { label: "RESUELTA", color: "status-validada", key: "resuelta", badgeClass: BADGE_CLASS.validada },
  CLOSED: { label: "CERRADA", color: "status-terminal", key: "cerrada", badgeClass: BADGE_CLASS.terminal },
  DISCARDED: { label: "DESCARTADA", color: "status-terminal", key: "descartada", badgeClass: BADGE_CLASS.terminal },
  // aliases legacy UI
  pendiente: { label: "PENDIENTE", color: "status-pendiente", key: "pendiente", badgeClass: BADGE_CLASS.pendiente },
  validada: { label: "VALIDADA", color: "status-validada", key: "validada", badgeClass: BADGE_CLASS.validada },
  en_camino: { label: "EN CAMINO", color: "status-despachada", key: "en_camino", badgeClass: BADGE_CLASS.despachada },
  en_lugar: { label: "EN LUGAR", color: "status-validada", key: "en_lugar", badgeClass: BADGE_CLASS.validada },
  despachada: { label: "DESPACHADA", color: "status-despachada", key: "despachada", badgeClass: BADGE_CLASS.despachada },
  resuelta: { label: "RESUELTA", color: "status-validada", key: "resuelta", badgeClass: BADGE_CLASS.validada },
  cancelada: { label: "CANCELADA", color: "status-terminal", key: "cancelada", badgeClass: BADGE_CLASS.terminal },
};

export const TYPE_LABELS = {
  // Canónicos del backend (src/domain/emergency-type.js)
  PANICO: "Botón de pánico",
  MEDICA: "Emergencia médica",
  INCENDIO: "Incendio",
  INFRAESTRUCTURA: "Infraestructura",
  DISTURBIO_EVENTO_MASIVO: "Disturbio o evento masivo",
  OTRO: "Otro incidente",
  // Alias que todavía manda el formulario (el backend los normaliza)
  panic: "Botón de pánico",
  medical: "Emergencia médica",
  fire: "Incendio",
  infrastructure: "Infraestructura",
  disturbance: "Disturbio o evento",
  other: "Otro incidente",
  // Legacy
  SEGURIDAD: "Seguridad",
  TRANSITO: "Tránsito",
};

export function emergencyTitle(emergency) {
  if (!emergency) return "Emergencia";
  if (emergency.description) return emergency.description;
  const typeLabel =
    TYPE_LABELS[emergency.emergencyType] ||
    TYPE_LABELS[String(emergency.emergencyType || "").toLowerCase()];
  if (typeLabel) return typeLabel;
  return "Emergencia";
}

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.CREATED;
}

export function isPendingStatus(status) {
  return status === "PENDING" || status === "CREATED" || status === "pendiente";
}

/** VALIDATED → se puede asignar oficial (backend: VALIDATED → DISPATCHED). */
export function canAssignOfficer(status) {
  return status === "VALIDATED";
}

export function isActiveStatus(status) {
  return !["CANCELLED", "CLOSED", "DISCARDED", "RESOLVED", "cancelada", "resuelta"].includes(
    status
  );
}

/**
 * Estados de los que la emergencia ya no sale (sin transición en la máquina
 * de estados del backend). RESOLVED no es terminal: el dispatcher todavía la
 * pasa a CLOSED, por eso no alcanza con `!isActiveStatus(status)`.
 */
export function isTerminalStatus(status) {
  return ["CANCELLED", "CLOSED", "DISCARDED"].includes(status);
}

export function isCancelable(status) {
  return status === "CREATED" || status === "PENDING" || status === "VALIDATED";
}

export function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (isToday) return `Hoy · ${time}`;
  if (isYesterday) return `Ayer · ${time}`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function formatTimeShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function elapsedMinutes(iso) {
  if (!iso) return "00:00";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * true solo si latitude/longitude son números reales presentes. OJO:
 * Number(null) === 0 y Number.isFinite(0) === true, así que antes una
 * emergencia sin ubicación (latitude/longitude null) pasaba como "válida"
 * con coords (0,0) y se geocodificaba como "océano Atlántico". Por eso acá
 * se descartan explícitamente null/undefined antes de convertir a Number.
 */
export function hasValidCoords(emergency) {
  if (!emergency || emergency.locationAnonymized || emergency.locationUnavailable) {
    return false;
  }
  const { latitude, longitude } = emergency;
  if (latitude === null || latitude === undefined) return false;
  if (longitude === null || longitude === undefined) return false;
  return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
}

export function locationLabel(emergency) {
  if (!emergency) return "Sin ubicación";
  if (emergency.locationAnonymized) {
    return "Ubicación anonimizada (retención)";
  }
  if (emergency.locationUnavailable) {
    return "Sin ubicación";
  }
  if (emergency.locationLabel) return emergency.locationLabel;
  if (hasValidCoords(emergency)) {
    return `${Number(emergency.latitude).toFixed(4)}, ${Number(emergency.longitude).toFixed(4)}`;
  }
  return "Sin ubicación";
}

// ── Incidente / prioridad efectiva (contrato 2026-09, PR en curso en
// emergencias-backend, todavía NO en producción) ──────────────────────────
//
// El backend va a empezar a mandar, en el listado y detalle de emergencias:
//   effectivePriority: "critical" | "high" | "medium" | "low" | undefined
//   incident: null | { id, priority, score, reportCount, uniqueCitizens, reasonCodes }
//
// Todo lo de acá abajo es null-safe a propósito: mientras el PR no esté en
// producción (y para cualquier emergencia vieja sin incidente asociado)
// `effectivePriority`/`incident` simplemente no vienen, y estas funciones
// tienen que devolver algo razonable sin romper.

/** Orden de severidad/prioridad, de menor a mayor. */
const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * Prioridad que muestran y ordenan las vistas del dispatcher. En orden:
 *  1. `dispatchPriority`: la prioridad de despacho del backend, que suma un
 *     nivel mientras hay un contexto de zona vigente en el barrio (p. ej. un
 *     evento en un espacio público en curso).
 *  2. `effectivePriority`: la del Risk Engine de detección de incidentes.
 *  3. `severity`: la original.
 * Úsala en vez de `emergency.severity` en cualquier badge/orden de prioridad
 * de las vistas del dispatcher.
 */
export function getEffectivePriority(emergency) {
  if (!emergency) return null;
  return (
    emergency.dispatchPriority ||
    emergency.effectivePriority ||
    emergency.severity ||
    null
  );
}

/**
 * true si el Risk Engine dejó la prioridad por encima de la severity
 * original por señales de incidente (varios reportes, proximidad, etc.).
 * Sirve para aclarar "Prioridad elevada por incidente (era Media)" en el
 * detalle. No cuenta la suba por contexto de zona: esa la informa
 * getZoneContext.
 */
export function isPriorityElevatedByIncident(emergency) {
  if (!emergency) return false;
  const effective = emergency.effectivePriority || emergency.severity;
  const original = emergency.severity;
  if (!effective || !original || effective === original) return false;
  const effectiveRank = PRIORITY_RANK[effective];
  const originalRank = PRIORITY_RANK[original];
  if (effectiveRank === undefined || originalRank === undefined) return false;
  return effectiveRank > originalRank;
}

const ZONE_CONTEXT_LABELS = {
  EVENTO_ESPACIO_PUBLICO: "Evento en la zona",
  ALERTA_CLIMATICA: "Alerta climática",
};

function barrioOrNull(value) {
  return typeof value === "string" && value.trim() ? formatBarrio(value) : null;
}

/**
 * Contexto de zona que está elevando la prioridad de despacho de la
 * emergencia (`priorityContext` del backend), normalizado para mostrar:
 * `label` corto para un pill y `reason` con el motivo completo. Devuelve
 * null si no hay ninguno vigente, que es el caso normal.
 *
 * - Evento en un espacio público: la zona es un radio alrededor del evento
 *   (backend #96), así que el contexto no trae barrio; si lo trae (formato
 *   anterior), se muestra.
 * - Alerta climática: la zona son barrios y el motivo nombra el barrio de
 *   la emergencia ("Elevada por alerta climática (Tormenta eléctrica, alta)
 *   en Palermo").
 */
export function getZoneContext(emergency) {
  const context = emergency?.priorityContext;
  if (!context || typeof context !== "object" || !context.tipo) return null;

  const label = ZONE_CONTEXT_LABELS[context.tipo] || "Contexto de zona";
  const descripcion =
    typeof context.descripcion === "string" && context.descripcion
      ? context.descripcion
      : null;
  const base = {
    tipo: context.tipo,
    label,
    descripcion,
    vigenteHasta: context.vigenteHasta ?? null,
  };

  if (context.tipo === "ALERTA_CLIMATICA") {
    const barrio = barrioOrNull(emergency.barrio);
    const fenomeno = formatFenomeno(context.fenomeno);
    const gravedad = formatGravedad(context.gravedad);
    const detalle = [fenomeno, gravedad].filter(Boolean).join(", ");
    let reason = "Elevada por alerta climática";
    if (detalle) reason += ` (${detalle})`;
    if (barrio) reason += ` en ${barrio}`;
    return { ...base, barrio, fenomeno, gravedad, reason };
  }

  const barrio = barrioOrNull(context.barrio);
  let reason = `Prioridad elevada: ${label.toLowerCase()}`;
  if (barrio) reason += ` (${barrio})`;
  if (descripcion) reason += ` · ${descripcion}`;

  return { ...base, barrio, reason };
}

/**
 * Resumen normalizado del incidente agrupado (varios reportes de la misma
 * zona/tipo agrupados por el Risk Engine en un único incidente). Devuelve
 * null si la emergencia no tiene incidente asociado — hoy siempre, hasta que
 * se mergee el PR del backend, o para cualquier emergencia sin agrupar.
 */
export function getIncidentSummary(emergency) {
  const incident = emergency?.incident;
  if (!incident || typeof incident !== "object") return null;
  return {
    id: incident.id ?? null,
    priority: incident.priority ?? null,
    score: typeof incident.score === "number" ? incident.score : null,
    reportCount:
      typeof incident.reportCount === "number" ? incident.reportCount : null,
    uniqueCitizens:
      typeof incident.uniqueCitizens === "number"
        ? incident.uniqueCitizens
        : null,
    reasonCodes: Array.isArray(incident.reasonCodes)
      ? incident.reasonCodes.filter((code) => typeof code === "string")
      : [],
  };
}

/**
 * reasonCodes del Risk Engine → texto humano en español. Cubre tanto los
 * códigos del contrato (MULTIPLE_REPORTS/CLOSE_PROXIMITY) como los que ya
 * usa la implementación en curso del backend (MULTI_REPORT_THRESHOLD/
 * PROXIMITY_CLUSTER/UNIQUE_CITIZENS_THRESHOLD); fallback al código legible
 * si aparece uno nuevo que todavía no mapeamos.
 */
const INCIDENT_REASON_LABELS = {
  MULTIPLE_REPORTS: "Múltiples reportes",
  MULTI_REPORT_THRESHOLD: "Múltiples reportes",
  CLOSE_PROXIMITY: "Reportes cercanos entre sí",
  PROXIMITY_CLUSTER: "Reportes cercanos entre sí",
  UNIQUE_CITIZENS_THRESHOLD: "Reportado por varios ciudadanos",
  SAME_TYPE: "Mismo tipo de emergencia",
  TIME_WINDOW: "Reportado en una ventana de tiempo corta",
};

export function translateIncidentReasonCode(code) {
  if (!code || typeof code !== "string") return "";
  return (
    INCIDENT_REASON_LABELS[code] ||
    code.replace(/_/g, " ").trim().toLowerCase()
  );
}

/**
 * Motivo de cierre/descarte de una emergencia. Prioriza campos directos
 * (`discardReason`/`closeReason`/`reason`, por si el backend llega a
 * exponerlos en el listado) y, si no hay, busca el último motivo del
 * historial de estados (`statusHistory`, que hoy solo viene en el detalle de
 * GET /api/emergencies/:id, no en el listado). null si no hay nada — quien
 * la use debe mostrar "—".
 */
export function getEmergencyReason(emergency) {
  if (!emergency) return null;
  const direct =
    emergency.discardReason || emergency.closeReason || emergency.reason;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (Array.isArray(emergency.statusHistory)) {
    for (let i = emergency.statusHistory.length - 1; i >= 0; i -= 1) {
      const entry = emergency.statusHistory[i];
      if (entry && typeof entry.reason === "string" && entry.reason.trim()) {
        return entry.reason.trim();
      }
    }
  }
  return null;
}
