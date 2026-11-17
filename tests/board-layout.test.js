import { describe, it, expect } from "vitest";
import {
  BOARD_COLUMN_MIN_PX,
  BOARD_GAP_PX,
  boardGridStyle,
  shortEmergencyId,
} from "../app/lib/boardLayout";

describe("boardGridStyle", () => {
  it("todas las columnas miden lo mismo, tengan o no tarjetas", () => {
    const style = boardGridStyle([3, 0, 1, 0, 0, 2]);
    expect(style.gridTemplateColumns).toBe(`repeat(6, minmax(${BOARD_COLUMN_MIN_PX}px, 1fr))`);
    expect(style.gap).toBe(BOARD_GAP_PX);
  });

  it("el ancho no depende de cuántas tarjetas hay", () => {
    expect(boardGridStyle([0, 0, 0, 0, 0, 0])).toEqual(boardGridStyle([5, 4, 3, 2, 1, 9]));
  });

  it("el ancho mínimo es el de todas las columnas al mínimo más los espacios", () => {
    expect(boardGridStyle([1, 2, 3, 4, 5, 6]).minWidth).toBe(6 * BOARD_COLUMN_MIN_PX + 5 * BOARD_GAP_PX);
  });

  it("las columnas no bajan de 260 px: si no entran, hay scroll horizontal", () => {
    expect(BOARD_COLUMN_MIN_PX).toBe(260);
    // 6 columnas en una pantalla de 1440 px con el menú abierto (~1128 px útiles).
    expect(boardGridStyle([0, 0, 0, 0, 0, 0]).minWidth).toBeGreaterThan(1128);
  });

  it("sin columnas no arma una grilla", () => {
    expect(boardGridStyle([])).toEqual({ gridTemplateColumns: "none", gap: BOARD_GAP_PX, minWidth: 0 });
    expect(boardGridStyle(undefined).minWidth).toBe(0);
  });
});

describe("shortEmergencyId", () => {
  it("devuelve los 8 primeros caracteres en mayúsculas", () => {
    expect(shortEmergencyId("6833bb75-1234-4abc-8def-000000000000")).toBe("6833BB75");
  });

  it("tolera valores vacíos", () => {
    expect(shortEmergencyId(null)).toBe("");
    expect(shortEmergencyId(undefined)).toBe("");
  });
});
