/**
 * Alertas climáticas activas, para el banner del tablero del dispatcher.
 *
 * Las publica Espacios y el backend las guarda como contextos de zona por
 * punto, con un radio según el nivel (ADR "Responder a las alertas
 * climáticas de Espacios"): mientras la alerta está en curso, las
 * emergencias que se crean a menos de ese radio de algún punto suben un
 * nivel de prioridad. Solo ALTA (500 m) y CRITICA (1000 m) generan
 * contextos: MEDIA y BAJA no llegan al banner.
 *
 * GET /api/contextos-zona/activos devuelve una entrada por alerta con
 * alertaId, nivel, fenomeno, fenomenoEtiqueta, barrios, vigenteDesde,
 * vigenteHasta, enCurso, puntos, radioMetros y descripcion.
 */
import { formatBarrio } from "./barrio";

// Niveles que suben prioridades. Cualquier otro nivel no se muestra.
const NIVEL_LABELS = {
  ALTA: "alta",
  CRITICA: "crítica",
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Código de fenómeno legible ("OLA_POLAR" → "Ola polar"). Es el respaldo si
 * el backend no manda `fenomenoEtiqueta` (que sale del catálogo de Espacios,
 * con tildes). Null si no hay fenómeno.
 */
export function formatFenomeno(fenomeno) {
  if (typeof fenomeno !== "string" || !fenomeno.trim()) return null;
  const words = fenomeno.trim().toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** "CRITICA" → "crítica". Null si no es un nivel que sube prioridades. */
export function formatNivel(nivel) {
  if (typeof nivel !== "string") return null;
  return NIVEL_LABELS[nivel.trim().toUpperCase()] ?? null;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function positiveIntOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Normaliza un elemento de GET /api/contextos-zona/activos. Devuelve null si
 * no tiene alertaId o si trae un nivel que no sube prioridades (no debería
 * pasar: el backend solo crea contextos para ALTA y CRITICA). Sin nivel
 * (contexto anterior a que el backend lo guardara) se muestra igual.
 */
export function normalizeAlertaClimatica(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = textOrNull(raw.alertaId);
  if (!id) return null;
  const nivelLabel = formatNivel(raw.nivel);
  if (raw.nivel != null && !nivelLabel) return null;

  const barrios = Array.isArray(raw.barrios)
    ? raw.barrios.filter((b) => typeof b === "string" && b.trim()).map(formatBarrio)
    : [];

  return {
    id,
    nivel: nivelLabel ? raw.nivel.trim().toUpperCase() : null,
    nivelLabel,
    fenomenoLabel: textOrNull(raw.fenomenoEtiqueta) ?? formatFenomeno(raw.fenomeno),
    barrios,
    descripcion: textOrNull(raw.descripcion),
    vigenteDesde: toDate(raw.vigenteDesde),
    vigenteHasta: toDate(raw.vigenteHasta),
    enCurso: raw.enCurso === true,
    puntos: positiveIntOrNull(raw.puntos),
    radioMetros: positiveIntOrNull(raw.radioMetros),
  };
}

/** Lista de la respuesta del backend (`{ data: [...] }` o el array solo). */
export function normalizeAlertasClimaticas(response) {
  const list = Array.isArray(response) ? response : response?.data;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAlertaClimatica).filter(Boolean);
}

function formatHora(date, now) {
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  });
  // Otro día lleva la fecha ("13/11 18:00"); el mismo día, solo la hora.
  return dia.format(date) === dia.format(now) ? hora : `${dia.format(date)} ${hora}`;
}

/** "sube un nivel a 500 m de 2 puntos", con lo que se sepa. */
function formatAlcance({ radioMetros, puntos }) {
  if (!radioMetros) return "sube un nivel cerca de la alerta";
  const base = `sube un nivel a ${radioMetros} m`;
  if (!puntos) return base;
  const cantidad = puntos === 1 ? "1 punto" : puntos + " puntos";
  return `${base} de ${cantidad}`;
}

/**
 * Línea del banner. En curso:
 * "Alerta alta · Tormenta fuerte · San Nicolas, Belgrano · hasta 23:00 · sube un nivel a 500 m de 2 puntos".
 * Programada (todavía no empezó):
 * "Alerta crítica · Granizo · Caballito · desde 21:00 · todavía no sube prioridades".
 */
export function formatAlertaClimatica(alerta, { now = new Date() } = {}) {
  const parts = [alerta.nivelLabel ? `Alerta ${alerta.nivelLabel}` : "Alerta climática"];
  if (alerta.fenomenoLabel) parts.push(alerta.fenomenoLabel);
  if (alerta.barrios.length > 0) parts.push(alerta.barrios.join(", "));
  if (alerta.enCurso) {
    if (alerta.vigenteHasta) parts.push(`hasta ${formatHora(alerta.vigenteHasta, now)}`);
    parts.push(formatAlcance(alerta));
  } else {
    if (alerta.vigenteDesde) parts.push(`desde ${formatHora(alerta.vigenteDesde, now)}`);
    parts.push("todavía no sube prioridades");
  }
  return parts.join(" · ");
}
