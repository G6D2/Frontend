/**
 * Clases de tabla únicas para /ops/lista y /ops/historial. Antes cada una
 * tenía su propio conjunto (padding p-3 vs p-2.5, thead sin fondo/tracking
 * en historial, tbody sin bg-surface-container-lowest, borde punteado en
 * historial vs sólido en lista, sin altura de fila fija en historial).
 *
 * Uso: className={`${TABLE_HEAD} ...`} / `${TABLE_TH}` / etc.
 */
export const TABLE_CONTAINER =
  "w-full bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden";

export const TABLE_HEAD = "bg-surface-container";

export const TABLE_TH =
  "p-2.5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant";

export const TABLE_BODY = "text-xs bg-surface-container-lowest";

export const TABLE_ROW =
  "h-10 border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors";

export const TABLE_CELL = "p-2.5";

export const TABLE_CELL_MONO = "p-2.5 font-mono text-[13px]";
