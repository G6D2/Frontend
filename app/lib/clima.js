/**
 * Alertas climáticas activas (contextos de zona ALERTA_CLIMATICA), para el
 * banner del tablero y el motivo de la suba de prioridad.
 *
 * Las publica Espacios y el backend las guarda como contexto de zona por
 * barrio (ADR "Elevar temporalmente la prioridad con contextos de zona").
 * Con gravedad LEVE o MEDIA el contexto existe pero no eleva nada
 * (`eleva: false`); con ALTA o EXTREMA sube un nivel los tipos afectados.
 */
import { formatBarrio } from "./barrio";

// Catálogo de fenómenos de Espacios (guía "CityPass Eventos climáticos",
// 13/11/2026), el mismo que usa el backend.
const FENOMENO_LABELS = {
  TORMENTA_FUERTE: "Tormenta fuerte",
  LLUVIA_INTENSA: "Lluvia intensa",
  VIENTO_FUERTE: "Viento fuerte",
  OLA_DE_CALOR: "Ola de calor",
  OLA_DE_FRIO: "Ola de frío",
  GRANIZO: "Granizo",
  TORMENTA_ELECTRICA: "Tormenta eléctrica",
  HURACAN: "Huracán",
  NIEVE: "Nieve",
};

const GRAVEDAD_LABELS = {
  LEVE: "leve",
  MEDIA: "media",
  ALTA: "alta",
  EXTREMA: "extrema",
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * "TORMENTA_ELECTRICA" → "Tormenta eléctrica". Un fenómeno que todavía no
 * está en el mapa se muestra legible ("OLA_POLAR" → "Ola polar") en vez del
 * código. Null si no hay fenómeno.
 */
export function formatFenomeno(fenomeno) {
  if (typeof fenomeno !== "string" || !fenomeno.trim()) return null;
  const code = fenomeno.trim().toUpperCase();
  if (FENOMENO_LABELS[code]) return FENOMENO_LABELS[code];
  const words = code.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** "ALTA" → "alta". Null si no es una gravedad conocida. */
export function formatGravedad(gravedad) {
  if (typeof gravedad !== "string") return null;
  return GRAVEDAD_LABELS[gravedad.trim().toUpperCase()] ?? null;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Normaliza un elemento de GET /api/contextos-zona/activos. Devuelve null
 * si no tiene lo mínimo para mostrarse (referencia y algún barrio).
 */
export function normalizeAlertaClimatica(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.referenciaExterna !== "string" || !raw.referenciaExterna) {
    return null;
  }
  const barrios = Array.isArray(raw.barrios)
    ? raw.barrios.filter((b) => typeof b === "string" && b.trim()).map(formatBarrio)
    : [];
  if (barrios.length === 0) return null;

  return {
    id: raw.referenciaExterna,
    fenomeno: typeof raw.fenomeno === "string" ? raw.fenomeno : null,
    fenomenoLabel: formatFenomeno(raw.fenomeno),
    gravedad: typeof raw.gravedad === "string" ? raw.gravedad : null,
    gravedadLabel: formatGravedad(raw.gravedad),
    eleva: raw.eleva === true,
    barrios,
    descripcion:
      typeof raw.descripcion === "string" && raw.descripcion
        ? raw.descripcion
        : null,
    vigenteDesde: toDate(raw.vigenteDesde),
    vigenteHasta: toDate(raw.vigenteHasta),
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
  // Una alerta que empieza (o empezó) otro día lleva la fecha: "desde
  // 13/11 18:00". Las del día, solo la hora.
  return dia.format(date) === dia.format(now) ? hora : `${dia.format(date)} ${hora}`;
}

/**
 * Línea del banner:
 * "Alerta alta · Tormenta eléctrica · Palermo, Recoleta · desde 18:00".
 * Si la alerta no eleva (LEVE/MEDIA), suma "sin cambio de prioridad".
 */
export function formatAlertaClimatica(alerta, { now = new Date() } = {}) {
  const parts = [alerta.gravedadLabel ? `Alerta ${alerta.gravedadLabel}` : "Alerta climática"];
  if (alerta.fenomenoLabel) parts.push(alerta.fenomenoLabel);
  parts.push(alerta.barrios.join(", "));
  if (alerta.vigenteDesde) parts.push(`desde ${formatHora(alerta.vigenteDesde, now)}`);
  if (!alerta.eleva) parts.push("sin cambio de prioridad");
  return parts.join(" · ");
}
