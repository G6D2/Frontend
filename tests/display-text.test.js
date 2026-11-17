import { describe, it, expect } from "vitest";
import {
  formatHistoryActor,
  formatHistoryReason,
  severityLabel,
  reporterLabel,
} from "../app/lib/displayText";

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

describe("formatHistoryActor", () => {
  const officers = [
    { id: "of-001", name: "Oficial Carlos Gómez" },
    { id: "of-020", name: "Ana Paz" },
  ];

  it("el dispatcher en validar, devolver, descartar, asignar y cerrar", () => {
    for (const newStatus of ["VALIDATED", "DISCARDED", "DISPATCHED", "CLOSED"]) {
      expect(formatHistoryActor({ actor: "DISP-Demo001", newStatus })).toBe("Dispatcher (DISP-Demo001)");
    }
    // El sub del Login Federado se muestra igual.
    expect(formatHistoryActor({ actor: "jperez", newStatus: "VALIDATED" })).toBe("Dispatcher (jperez)");
  });

  it("el oficial por su nombre si está en el catálogo", () => {
    expect(formatHistoryActor({ actor: "of-001", newStatus: "EN_ROUTE" }, officers)).toBe("Oficial Carlos Gómez");
    expect(formatHistoryActor({ actor: "of-020", newStatus: "RESOLVED" }, officers)).toBe("Oficial Ana Paz");
  });

  it("el oficial por su id si no está en el catálogo o no hay catálogo", () => {
    expect(formatHistoryActor({ actor: "of-099", newStatus: "ON_SCENE" }, officers)).toBe("Oficial (of-099)");
    expect(formatHistoryActor({ actor: "of-001", newStatus: "ON_SCENE" })).toBe("Oficial (of-001)");
    expect(formatHistoryActor({ actor: "of-001", newStatus: "ON_SCENE" }, [{ id: "of-001", name: " " }])).toBe(
      "Oficial (of-001)"
    );
  });

  it("los actores de sistema en castellano, sea cual sea la transición", () => {
    expect(formatHistoryActor({ actor: "eda:reclamos", newStatus: "CANCELLED" })).toBe("Reclamos (automático)");
    expect(formatHistoryActor({ actor: "eda:espacios", newStatus: "CANCELLED" })).toBe("Espacios (automático)");
    expect(formatHistoryActor({ actor: "sistema:expiracion", newStatus: "DISCARDED" })).toBe("Expiración automática");
  });

  it("el ciudadano que cancela, sin su id", () => {
    expect(formatHistoryActor({ actor: "CIT-JuanPanico", newStatus: "CANCELLED" })).toBe("Ciudadano");
  });

  it("un actor que no se reconoce se muestra tal cual", () => {
    expect(formatHistoryActor({ actor: "eda:movilidad", newStatus: "PENDING" })).toBe("eda:movilidad");
    expect(formatHistoryActor({ actor: " alguien ", newStatus: undefined })).toBe("alguien");
  });

  it("sin actor no se muestra nada", () => {
    expect(formatHistoryActor({ actor: null, newStatus: "VALIDATED" })).toBe("");
    expect(formatHistoryActor({ actor: "  ", newStatus: "VALIDATED" })).toBe("");
    expect(formatHistoryActor({ newStatus: "VALIDATED" })).toBe("");
    expect(formatHistoryActor(null)).toBe("");
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
