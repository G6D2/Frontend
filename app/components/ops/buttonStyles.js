/**
 * Estilos de botón únicos para todo /ops (mismas clases que ya usa el
 * ciudadano): primario, secundario con borde y peligro. Antes cada página
 * tenía su propia combinación (bg-secondary, bg-primary/40, botones sin
 * cursor-pointer ni hover, distintos radios/tamaños de texto).
 *
 * Uso: className={`${BTN_BASE} ${BTN_PRIMARY}`} (o BTN_SECONDARY / BTN_DANGER).
 */
export const BTN_BASE =
  "inline-flex items-center justify-center gap-2 min-h-touch rounded-lg text-xs font-bold uppercase tracking-widest cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const BTN_PRIMARY = "bg-primary text-on-primary hover:opacity-90";

export const BTN_SECONDARY =
  "border border-outline-variant text-on-surface hover:bg-surface-container";

export const BTN_DANGER = "bg-error text-on-error hover:opacity-90";
