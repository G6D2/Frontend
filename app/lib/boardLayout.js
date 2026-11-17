/**
 * Anchos del tablero kanban de escritorio (DispatcherView).
 *
 * Todas las columnas miden lo mismo, tengan o no tarjetas: 260 px como mínimo,
 * para que la tarjeta se lea cómoda, y se estiran para ocupar el ancho cuando
 * sobra (en 1920 px entran las 6 sin scroll). Cuando no entran aparece el
 * scroll horizontal, con la barra siempre visible (boardScrollArea en
 * styles.module.css) para que no parezca que la última columna está cortada.
 */
export const BOARD_COLUMN_MIN_PX = 260;
export const BOARD_GAP_PX = 12;

/**
 * Estilo del contenedor (CSS grid) del tablero.
 *
 * @param {number[]} counts  Cantidad de tarjetas por columna, en orden (solo
 *   importa cuántas columnas son: el ancho ya no depende de las tarjetas).
 * @returns {{ gridTemplateColumns: string, gap: number, minWidth: number }}
 */
export function boardGridStyle(counts) {
  const columns = Array.isArray(counts) ? counts.length : 0;
  // Ancho mínimo del tablero: por debajo de esto aparece el scroll horizontal
  // en vez de apretar las columnas.
  const minWidth = columns * BOARD_COLUMN_MIN_PX + BOARD_GAP_PX * Math.max(columns - 1, 0);
  return {
    gridTemplateColumns: columns > 0 ? `repeat(${columns}, minmax(${BOARD_COLUMN_MIN_PX}px, 1fr))` : "none",
    gap: BOARD_GAP_PX,
    minWidth,
  };
}

/** Id corto para mostrar en una tarjeta (los 8 primeros caracteres, como el historial). */
export function shortEmergencyId(id) {
  return String(id ?? "").slice(0, 8).toUpperCase();
}
