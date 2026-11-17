import { describe, it, expect } from "vitest";
import { formatHistoryReason, severityLabel, reporterLabel } from "../app/lib/displayText";

describe("formatHistoryReason", () => {
  it("traduce la asignación del backend y saca el id del oficial", () => {
    expect(formatHistoryReason("Assigned officer of-001")).toBe("Se asignó un oficial");
    expect(formatHistoryReason("  assigned officer of-010 ")).toBe("Se asignó un oficial");
  });

  it("deja como están los motivos que escribe una persona", () => {
    expect(formatHistoryReason("Ya no necesito asistencia")).toBe("Ya no necesito asistencia");
    expect(formatHistoryReason("Reclamo RESUELTO")).toBe("Reclamo RESUELTO");
  });

  it("vacío o no string → cadena vacía", () => {
    expect(formatHistoryReason("")).toBe("");
    expect(formatHistoryReason("   ")).toBe("");
    expect(formatHistoryReason(null)).toBe("");
    expect(formatHistoryReason(undefined)).toBe("");
  });
});

describe("severityLabel", () => {
  it("muestra la severidad en castellano", () => {
    expect(severityLabel("high")).toBe("Alta");
    expect(severityLabel("CRITICAL")).toBe("Crítica");
    expect(severityLabel("low")).toBe("Baja");
  });

  it("un valor desconocido se muestra tal cual y vacío es —", () => {
    expect(severityLabel("rara")).toBe("rara");
    expect(severityLabel(null)).toBe("—");
  });
});

describe("reporterLabel", () => {
  it("el usuario si lo hay", () => {
    expect(reporterLabel({ userId: "CIT-JuanPanico" })).toBe("CIT-JuanPanico");
  });

  it("si la creó otro módulo, su origen", () => {
    expect(reporterLabel({ userId: null, causaTipo: "RECLAMO", source: "EXTERNAL" })).toBe("Reclamo ciclovía");
    expect(reporterLabel({ userId: null, causaTipo: "EVENTO_PUBLICO", source: "EXTERNAL" })).toBe("Cobertura: evento");
  });

  it("sin usuario ni origen, —", () => {
    expect(reporterLabel({ userId: null, source: "INTERNAL" })).toBe("—");
    expect(reporterLabel(null)).toBe("—");
  });
});
