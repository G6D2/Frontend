export const PRIORITY_CONFIG = {
  critical: { label: "ALTA", color: "priority-high", bg: "bg-priority-high/20" },
  high: { label: "ALTA", color: "priority-high", bg: "bg-priority-high/20" },
  medium: { label: "MEDIA", color: "priority-med", bg: "bg-priority-med/20" },
  low: { label: "BAJA", color: "priority-low", bg: "bg-priority-low/20" },
};

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

export function isActiveStatus(status) {
  return !["CANCELLED", "CLOSED", "DISCARDED", "RESOLVED", "cancelada", "resuelta"].includes(
    status
  );
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

export function hasValidCoords(emergency) {
  if (!emergency || emergency.locationAnonymized) return false;
  return (
    Number.isFinite(Number(emergency.latitude)) &&
    Number.isFinite(Number(emergency.longitude))
  );
}

export function locationLabel(emergency) {
  if (!emergency) return "Sin ubicación";
  if (emergency.locationAnonymized) {
    return "Ubicación anonimizada (retención)";
  }
  if (emergency.locationLabel) return emergency.locationLabel;
  if (hasValidCoords(emergency)) {
    return `${Number(emergency.latitude).toFixed(4)}, ${Number(emergency.longitude).toFixed(4)}`;
  }
  return "Sin ubicación";
}
