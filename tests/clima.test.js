import { describe, expect, it } from "vitest";
import {
  formatAlertaClimatica,
  formatFenomeno,
  formatNivel,
  normalizeAlertaClimatica,
  normalizeAlertasClimaticas,
} from "../app/lib/clima";

// Un elemento de GET /api/contextos-zona/activos (una entrada por alerta).
const ALERTA = {
  alertaId: "6f1c2a8e-3b4d-4c5e-9f60-7a8b9c0d1e2f",
  nivel: "ALTA",
  fenomeno: "TORMENTA_ELECTRICA",
  fenomenoEtiqueta: "Tormenta eléctrica",
  barrios: ["PALERMO", "VILLA DEL PARQUE"],
  descripcion: "Alerta climática ALTA: tormenta electrica",
  // 18:00 a 03:00 en Buenos Aires (UTC-3).
  vigenteDesde: "2026-11-12T21:00:00.000Z",
  vigenteHasta: "2026-11-13T06:00:00.000Z",
  enCurso: true,
  puntos: 2,
  radioMetros: 500,
};
// 20:30 del mismo día en Buenos Aires.
const NOW = new Date("2026-11-12T23:30:00.000Z");

describe("formatFenomeno", () => {
  it("makes a phenomenon code readable (fallback when the backend sends no label)", () => {
    expect(formatFenomeno("OLA_POLAR")).toBe("Ola polar");
    expect(formatFenomeno("granizo")).toBe("Granizo");
  });

  it("is null-safe", () => {
    expect(formatFenomeno(null)).toBeNull();
    expect(formatFenomeno("  ")).toBeNull();
    expect(formatFenomeno("___")).toBeNull();
    expect(formatFenomeno(3)).toBeNull();
  });
});

describe("formatNivel", () => {
  it("labels only the levels that raise priority (ALTA, CRITICA)", () => {
    expect(formatNivel("CRITICA")).toBe("crítica");
    expect(formatNivel(" alta ")).toBe("alta");
    expect(formatNivel("MEDIA")).toBeNull();
    expect(formatNivel("BAJA")).toBeNull();
    expect(formatNivel(undefined)).toBeNull();
  });
});

describe("normalizeAlertaClimatica", () => {
  it("normalizes a backend item", () => {
    const alerta = normalizeAlertaClimatica(ALERTA);
    expect(alerta).toMatchObject({
      id: ALERTA.alertaId,
      nivel: "ALTA",
      nivelLabel: "alta",
      fenomenoLabel: "Tormenta eléctrica",
      barrios: ["Palermo", "Villa del Parque"],
      descripcion: "Alerta climática ALTA: tormenta electrica",
      enCurso: true,
      puntos: 2,
      radioMetros: 500,
    });
    expect(alerta.vigenteDesde.toISOString()).toBe(ALERTA.vigenteDesde);
    expect(alerta.vigenteHasta.toISOString()).toBe(ALERTA.vigenteHasta);
  });

  it("uses the readable code when there is no label", () => {
    expect(normalizeAlertaClimatica({ ...ALERTA, fenomenoEtiqueta: null }).fenomenoLabel).toBe(
      "Tormenta electrica"
    );
    expect(
      normalizeAlertaClimatica({ ...ALERTA, fenomenoEtiqueta: " ", fenomeno: null }).fenomenoLabel
    ).toBeNull();
  });

  it("drops items without alertaId or with a level that does not raise priority", () => {
    expect(normalizeAlertaClimatica(null)).toBeNull();
    expect(normalizeAlertaClimatica("x")).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, alertaId: "" })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, alertaId: 7 })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, nivel: "MEDIA" })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, nivel: "BAJA" })).toBeNull();
  });

  it("keeps an alert without level or barrios (older backend rows) and tolerates bad fields", () => {
    const alerta = normalizeAlertaClimatica({
      alertaId: "a-1",
      nivel: null,
      barrios: [null, " "],
      vigenteDesde: "x",
      enCurso: "true",
      puntos: 0,
      radioMetros: "500",
    });
    expect(alerta).toEqual({
      id: "a-1",
      nivel: null,
      nivelLabel: null,
      fenomenoLabel: null,
      barrios: [],
      descripcion: null,
      vigenteDesde: null,
      vigenteHasta: null,
      enCurso: false,
      zona: "PUNTOS",
      puntos: null,
      radioMetros: null,
    });
  });

  it("keeps the zone: BARRIOS only when the backend says so, PUNTOS otherwise", () => {
    expect(normalizeAlertaClimatica({ ...ALERTA, zona: "BARRIOS" }).zona).toBe("BARRIOS");
    expect(normalizeAlertaClimatica({ ...ALERTA, zona: "barrios" }).zona).toBe("PUNTOS");
    expect(normalizeAlertaClimatica(ALERTA).zona).toBe("PUNTOS");
  });
});

describe("normalizeAlertasClimaticas", () => {
  it("accepts { data: [...] } or a bare array, and drops invalid items", () => {
    expect(normalizeAlertasClimaticas({ data: [ALERTA, {}] })).toHaveLength(1);
    expect(normalizeAlertasClimaticas([ALERTA])).toHaveLength(1);
    expect(normalizeAlertasClimaticas(null)).toEqual([]);
    expect(normalizeAlertasClimaticas({ data: "x" })).toEqual([]);
  });
});

describe("formatAlertaClimatica", () => {
  it("an alert in progress says until when and where it raises priority", () => {
    const alerta = normalizeAlertaClimatica(ALERTA);
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta alta · Tormenta eléctrica · Palermo, Villa del Parque · hasta 13/11 03:00 · sube un nivel a 500 m de 2 puntos"
    );
  });

  it("a scheduled alert says from when and that it does not raise priority yet", () => {
    const alerta = normalizeAlertaClimatica({
      ...ALERTA,
      nivel: "CRITICA",
      fenomenoEtiqueta: "Granizo",
      barrios: ["CABALLITO"],
      vigenteDesde: "2026-11-13T00:00:00.000Z",
      enCurso: false,
      puntos: 1,
      radioMetros: 1000,
    });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta crítica · Granizo · Caballito · desde 21:00 · todavía no sube prioridades"
    );
  });

  it("a barrio-zoned alert says it raises priority in those barrios, without radius or points", () => {
    const alerta = normalizeAlertaClimatica({ ...ALERTA, zona: "BARRIOS", radioMetros: null, puntos: 2 });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta alta · Tormenta eléctrica · Palermo, Villa del Parque · hasta 13/11 03:00 · sube un nivel en esos barrios"
    );
    const unBarrio = normalizeAlertaClimatica({ ...ALERTA, zona: "BARRIOS", barrios: ["COGHLAN"], puntos: 1 });
    expect(formatAlertaClimatica(unBarrio, { now: NOW })).toContain("Coghlan · hasta 13/11 03:00 · sube un nivel en ese barrio");
  });

  it("says one point in singular and the same-day end time without date", () => {
    const alerta = normalizeAlertaClimatica({
      ...ALERTA,
      puntos: 1,
      vigenteHasta: "2026-11-13T02:00:00.000Z",
    });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toContain("hasta 23:00 · sube un nivel a 500 m de 1 punto");
  });

  it("falls back when level, phenomenon, barrios, dates, radius and points are unknown", () => {
    const enCurso = normalizeAlertaClimatica({ alertaId: "a-1", enCurso: true });
    expect(formatAlertaClimatica(enCurso, { now: NOW })).toBe(
      "Alerta climática · sube un nivel cerca de la alerta"
    );
    const sinPuntos = normalizeAlertaClimatica({ alertaId: "a-1", enCurso: true, radioMetros: 500 });
    expect(formatAlertaClimatica(sinPuntos, { now: NOW })).toBe("Alerta climática · sube un nivel a 500 m");
    const programada = normalizeAlertaClimatica({ alertaId: "a-1", enCurso: false });
    expect(formatAlertaClimatica(programada)).toBe("Alerta climática · todavía no sube prioridades");
  });
});
