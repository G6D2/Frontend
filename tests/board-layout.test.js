import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMN_MAX_PX,
  BOARD_COLUMN_MIN_PX,
  BOARD_EMPTY_COLUMN_PX,
  BOARD_GAP_PX,
  boardGridStyle,
  shortEmergencyId,
} from "../app/lib/boardLayout";

const ANCHA = `minmax(${BOARD_COLUMN_MIN_PX}px, ${BOARD_COLUMN_MAX_PX}px)`;
const VACIA = `${BOARD_EMPTY_COLUMN_PX}px`;

describe("boardGridStyle", () => {
  it("da ancho completo a las columnas con tarjetas y angosto a las vacías", () => {
    const style = boardGridStyle([2, 0, 1, 0, 0, 3]);
    expect(style.gridTemplateColumns).toBe(
      [ANCHA, VACIA, ANCHA, VACIA, VACIA, ANCHA].join(" ")
    );
  });

  it("el ancho mínimo suma las columnas y los espacios entre ellas", () => {
    const style = boardGridStyle([2, 0, 1, 0, 0, 3]);
    expect(style.minWidth).toBe(
      3 * BOARD_COLUMN_MIN_PX + 3 * BOARD_EMPTY_COLUMN_PX + 5 * BOARD_GAP_PX
    );
  });

  it("con las 6 columnas con tarjetas entra en 1920 px con el menú abierto", () => {
    // 1920 - 280 del menú lateral - 32 de padding - 12 de margen = 1596.
    expect(boardGridStyle([1, 1, 1, 1, 1, 1]).minWidth).toBeLessThanOrEqual(1596);
  });

  it("una columna con tarjetas deja más lugar al texto que los 230 px de antes", () => {
    expect(boardGridStyle([1]).minWidth).toBe(BOARD_COLUMN_MIN_PX);
    expect(BOARD_COLUMN_MIN_PX).toBeGreaterThan(230);
  });

  it("el espacio entre columnas sale del mismo lugar que el ancho mínimo", () => {
    expect(boardGridStyle([1, 0]).gap).toBe(BOARD_GAP_PX);
  });

  it("mientras carga todas las columnas van anchas (ahí se dibuja el skeleton)", () => {
    const style = boardGridStyle([0, 0, 0], { loading: true });
    expect(style.gridTemplateColumns).toBe([ANCHA, ANCHA, ANCHA].join(" "));
    expect(style.minWidth).toBe(3 * BOARD_COLUMN_MIN_PX + 2 * BOARD_GAP_PX);
  });

  it("sin columnas no rompe", () => {
    expect(boardGridStyle([])).toEqual({ gridTemplateColumns: "", gap: BOARD_GAP_PX, minWidth: 0 });
  });

  it("trata como vacía una cantidad que no es un número positivo", () => {
    expect(boardGridStyle([2, undefined, null, -1]).gridTemplateColumns).toBe(
      [ANCHA, VACIA, VACIA, VACIA].join(" ")
    );
  });

  it("sin ninguna emergencia las columnas se reparten todo el ancho", () => {
    const style = boardGridStyle([0, 0, 0]);
    const repartida = `minmax(${BOARD_EMPTY_COLUMN_PX}px, 1fr)`;
    expect(style.gridTemplateColumns).toBe([repartida, repartida, repartida].join(" "));
    expect(style.minWidth).toBe(3 * BOARD_EMPTY_COLUMN_PX + 2 * BOARD_GAP_PX);
  });
});

describe("shortEmergencyId", () => {
  it("devuelve los 8 primeros caracteres en mayúscula", () => {
    expect(shortEmergencyId("a2a3f8ce-5cc9-4fe6-a7fc-505492b5edd8")).toBe("A2A3F8CE");
  });

  it("tolera ids cortos, numéricos o ausentes", () => {
    expect(shortEmergencyId("abc")).toBe("ABC");
    expect(shortEmergencyId(12345678901)).toBe("12345678");
    expect(shortEmergencyId(undefined)).toBe("");
    expect(shortEmergencyId(null)).toBe("");
  });
});
