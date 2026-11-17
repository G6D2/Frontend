import { describe, expect, it } from "vitest";
import {
  formatAlertaClimatica,
  formatFenomeno,
  formatGravedad,
  normalizeAlertaClimatica,
  normalizeAlertasClimaticas,
} from "../app/lib/clima";

const ALERTA = {
  referenciaExterna: "6f1c2a8e-3b4d-4c5e-9f60-7a8b9c0d1e2f",
  tipo: "ALERTA_CLIMATICA",
  fenomeno: "TORMENTA_ELECTRICA",
  gravedad: "ALTA",
  eleva: true,
  tiposEmergencia: ["INCENDIO", "INFRAESTRUCTURA", "TRANSITO"],
  barrios: ["PALERMO", "VILLA DEL PARQUE"],
  descripcion: "Tormentas fuertes con caída de granizo",
  // 18:00 en Buenos Aires (UTC-3).
  vigenteDesde: "2026-11-12T21:00:00.000Z",
  vigenteHasta: "2026-11-13T06:00:00.000Z",
};
// 20:30 del mismo día en Buenos Aires.
const NOW = new Date("2026-11-12T23:30:00.000Z");

describe("formatFenomeno", () => {
  it("maps known phenomena", () => {
    expect(formatFenomeno("TORMENTA_ELECTRICA")).toBe("Tormenta eléctrica");
    expect(formatFenomeno("inundacion")).toBe("Inundación");
  });

  it("maps the phenomena of Espacios' real catalog, with accents", () => {
    expect(formatFenomeno("LLUVIA_INTENSA")).toBe("Lluvia intensa");
    expect(formatFenomeno("TORMENTA_FUERTE")).toBe("Tormenta fuerte");
    expect(formatFenomeno("OLA_DE_FRIO")).toBe("Ola de frío");
    expect(formatFenomeno("HURACAN")).toBe("Huracán");
    expect(formatFenomeno("NIEVE")).toBe("Nieve");
  });

  it("makes unknown phenomena readable instead of showing the code", () => {
    expect(formatFenomeno("OLA_POLAR")).toBe("Ola polar");
  });

  it("is null-safe", () => {
    expect(formatFenomeno(null)).toBeNull();
    expect(formatFenomeno("  ")).toBeNull();
    expect(formatFenomeno(3)).toBeNull();
  });
});

describe("formatGravedad", () => {
  it("returns the lowercase label for known severities and null otherwise", () => {
    expect(formatGravedad("EXTREMA")).toBe("extrema");
    expect(formatGravedad("leve")).toBe("leve");
    expect(formatGravedad("ROJA")).toBeNull();
    expect(formatGravedad(undefined)).toBeNull();
  });
});

describe("normalizeAlertaClimatica", () => {
  it("normalizes a backend item", () => {
    const alerta = normalizeAlertaClimatica(ALERTA);
    expect(alerta).toMatchObject({
      id: ALERTA.referenciaExterna,
      fenomenoLabel: "Tormenta eléctrica",
      gravedadLabel: "alta",
      eleva: true,
      barrios: ["Palermo", "Villa del Parque"],
      descripcion: "Tormentas fuertes con caída de granizo",
    });
    expect(alerta.vigenteDesde.toISOString()).toBe(ALERTA.vigenteDesde);
  });

  it("drops items without reference or barrios, and treats a missing eleva as false", () => {
    expect(normalizeAlertaClimatica(null)).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, referenciaExterna: "" })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, barrios: [] })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, barrios: [null, " "] })).toBeNull();
    expect(normalizeAlertaClimatica({ ...ALERTA, eleva: undefined }).eleva).toBe(false);
    expect(normalizeAlertaClimatica({ ...ALERTA, vigenteDesde: "x" }).vigenteDesde).toBeNull();
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
  it("builds the banner line with the Buenos Aires start time", () => {
    const alerta = normalizeAlertaClimatica(ALERTA);
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta alta · Tormenta eléctrica · Palermo, Villa del Parque · desde 18:00"
    );
  });

  it("flags alerts that do not raise priority", () => {
    const alerta = normalizeAlertaClimatica({ ...ALERTA, gravedad: "LEVE", eleva: false });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta leve · Tormenta eléctrica · Palermo, Villa del Parque · desde 18:00 · sin cambio de prioridad"
    );
  });

  it("adds the date when the alert starts on another day", () => {
    const alerta = normalizeAlertaClimatica({
      ...ALERTA,
      vigenteDesde: "2026-11-13T21:00:00.000Z",
    });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toContain("desde 13/11 18:00");
  });

  it("falls back when severity and phenomenon are unknown", () => {
    const alerta = normalizeAlertaClimatica({
      ...ALERTA,
      gravedad: null,
      fenomeno: null,
      vigenteDesde: null,
      eleva: false,
    });
    expect(formatAlertaClimatica(alerta, { now: NOW })).toBe(
      "Alerta climática · Palermo, Villa del Parque · sin cambio de prioridad"
    );
  });
});
