/**
 * Anchos del tablero kanban de escritorio (DispatcherView).
 *
 * Con los 230 px fijos de antes quedaban unos 156 px útiles por tarjeta: los
 * botones se cortaban y una sola tarjeta ocupaba más alto que la columna.
 * Ahora una columna con tarjetas mide entre 250 y 420 px según el espacio que
 * haya, y una vacía, que solo muestra su título, cede el lugar a las demás.
 * 250 de mínimo es lo que deja entrar las 6 columnas con tarjetas en una
 * pantalla de 1920 px con el menú lateral abierto (6 × 250 + 5 × 16 = 1580).
 */
export const BOARD_COLUMN_MIN_PX = 250;
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
 * @returns {{ gridTemplateColumns: string, gap: number, minWidth: number }}
 */
export function boardGridStyle(counts, { loading = false } = {}) {
  const empty = counts.map((count) => !loading && !(count > 0));
  // Sin ninguna emergencia no hay a quién cederle el lugar: las columnas se
  // reparten todo el ancho en vez de quedar angostas contra la izquierda.
  const allEmpty = empty.length > 0 && empty.every(Boolean);
  const tracks = empty.map((isEmpty) => {
    if (allEmpty) return `minmax(${BOARD_EMPTY_COLUMN_PX}px, 1fr)`;
    return isEmpty
      ? `${BOARD_EMPTY_COLUMN_PX}px`
      : `minmax(${BOARD_COLUMN_MIN_PX}px, ${BOARD_COLUMN_MAX_PX}px)`;
  });
  // Ancho mínimo del tablero: por debajo de esto aparece el scroll horizontal
  // en vez de apretar las columnas.
  const minWidth =
    empty.reduce(
      (total, isEmpty) => total + (isEmpty ? BOARD_EMPTY_COLUMN_PX : BOARD_COLUMN_MIN_PX),
      0
    ) + BOARD_GAP_PX * Math.max(counts.length - 1, 0);
  return { gridTemplateColumns: tracks.join(" "), gap: BOARD_GAP_PX, minWidth };
}

/** Id corto para mostrar en una tarjeta (los 8 primeros caracteres, como el historial). */
export function shortEmergencyId(id) {
  return String(id ?? "").slice(0, 8).toUpperCase();
}
