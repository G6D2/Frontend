/**
 * Anchos del tablero kanban de escritorio (DispatcherView).
 *
 * Una columna con tarjetas necesita al menos 280 px para que el texto y los
 * botones entren: con los 230 px fijos de antes quedaban unos 156 px útiles
 * por tarjeta, los botones se cortaban y una sola tarjeta ocupaba más alto que
 * la columna. Una columna vacía solo muestra su título, así que cede el
 * espacio a las que sí tienen tarjetas.
 */
export const BOARD_COLUMN_MIN_PX = 280;
export const BOARD_COLUMN_MAX_PX = 420;
export const BOARD_EMPTY_COLUMN_PX = 170;
export const BOARD_GAP_PX = 16;

/**
 * Estilo del contenedor (CSS grid) según cuántas tarjetas tiene cada columna.
 * Mientras carga no se sabe cuáles van a quedar vacías: todas van anchas, que
 * es donde se dibuja el skeleton.
 *
 * @param {number[]} counts  Cantidad de tarjetas por columna, en orden.
 * @param {{ loading?: boolean }} [options]
 * @returns {{ gridTemplateColumns: string, minWidth: number }}
 */
export function boardGridStyle(counts, { loading = false } = {}) {
  const empty = counts.map((count) => !loading && !(count > 0));
  const tracks = empty.map((isEmpty) =>
    isEmpty
      ? `${BOARD_EMPTY_COLUMN_PX}px`
      : `minmax(${BOARD_COLUMN_MIN_PX}px, ${BOARD_COLUMN_MAX_PX}px)`
  );
  // Ancho mínimo del tablero: por debajo de esto aparece el scroll horizontal
  // en vez de apretar las columnas.
  const minWidth =
    empty.reduce(
      (total, isEmpty) => total + (isEmpty ? BOARD_EMPTY_COLUMN_PX : BOARD_COLUMN_MIN_PX),
      0
    ) + BOARD_GAP_PX * Math.max(counts.length - 1, 0);
  return { gridTemplateColumns: tracks.join(" "), minWidth };
}

/** Id corto para mostrar en una tarjeta (los 8 primeros caracteres, como el historial). */
export function shortEmergencyId(id) {
  return String(id ?? "").slice(0, 8).toUpperCase();
}
