import { describe, it, expect } from "vitest";
import {
  emergencyTitle,
  getStatusConfig,
  isPendingStatus,
  isActiveStatus,
  isCancelable,
  formatTime,
  formatTimeShort,
  elapsedMinutes,
  hasValidCoords,
  locationLabel,
} from "../app/lib/emergencies";

describe("emergencyTitle", () => {
  it("returns 'Emergencia' for null", () => {
    expect(emergencyTitle(null)).toBe("Emergencia");
  });

  it("returns description when present", () => {
    expect(emergencyTitle({ description: "Persona caída" })).toBe("Persona caída");
  });

  it("returns label for canonical backend type", () => {
    expect(emergencyTitle({ emergencyType: "MEDICA" })).toBe("Emergencia médica");
    expect(emergencyTitle({ emergencyType: "INCENDIO" })).toBe("Incendio");
  });

  it("returns label for frontend alias", () => {
    expect(emergencyTitle({ emergencyType: "medical" })).toBe("Emergencia médica");
    expect(emergencyTitle({ emergencyType: "panic" })).toBe("Botón de pánico");
  });

  it("returns 'Emergencia' for unknown type", () => {
    expect(emergencyTitle({ emergencyType: "DESCONOCIDO" })).toBe("Emergencia");
  });
});

describe("getStatusConfig", () => {
  it("returns config for known status", () => {
    expect(getStatusConfig("PENDING")).toMatchObject({ label: "PENDIENTE" });
    expect(getStatusConfig("VALIDATED")).toMatchObject({ label: "VALIDADA" });
    expect(getStatusConfig("DISCARDED")).toMatchObject({ label: "DESCARTADA" });
  });

  it("falls back to CREATED config for unknown status", () => {
    expect(getStatusConfig("UNKNOWN_XYZ")).toMatchObject({ label: "PENDIENTE" });
  });
});

describe("isPendingStatus", () => {
  it("returns true for PENDING, CREATED, pendiente", () => {
    expect(isPendingStatus("PENDING")).toBe(true);
    expect(isPendingStatus("CREATED")).toBe(true);
    expect(isPendingStatus("pendiente")).toBe(true);
  });

  it("returns false for non-pending statuses", () => {
    expect(isPendingStatus("VALIDATED")).toBe(false);
    expect(isPendingStatus("CLOSED")).toBe(false);
    expect(isPendingStatus("DISPATCHED")).toBe(false);
  });
});

describe("isActiveStatus", () => {
  it("returns false for all terminal statuses", () => {
    const terminals = ["CANCELLED", "CLOSED", "DISCARDED", "RESOLVED", "cancelada", "resuelta"];
    for (const s of terminals) {
      expect(isActiveStatus(s)).toBe(false);
    }
  });

  it("returns true for active statuses", () => {
    expect(isActiveStatus("PENDING")).toBe(true);
    expect(isActiveStatus("VALIDATED")).toBe(true);
    expect(isActiveStatus("DISPATCHED")).toBe(true);
    expect(isActiveStatus("EN_ROUTE")).toBe(true);
    expect(isActiveStatus("ON_SCENE")).toBe(true);
  });
});

describe("isCancelable", () => {
  it("returns true for CREATED, PENDING, VALIDATED", () => {
    expect(isCancelable("CREATED")).toBe(true);
    expect(isCancelable("PENDING")).toBe(true);
    expect(isCancelable("VALIDATED")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isCancelable("DISPATCHED")).toBe(false);
    expect(isCancelable("CLOSED")).toBe(false);
    expect(isCancelable("DISCARDED")).toBe(false);
  });
});

describe("formatTime", () => {
  it("returns '—' for null or undefined", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
  });

  it("returns 'Hoy · HH:MM' for a timestamp from today", () => {
    const now = new Date().toISOString();
    expect(formatTime(now)).toMatch(/^Hoy · /);
  });

  it("returns a date string for an old date", () => {
    const old = "2020-03-15T10:00:00.000Z";
    const result = formatTime(old);
    expect(result).not.toMatch(/^Hoy/);
    expect(result).not.toMatch(/^Ayer/);
  });
});

describe("formatTimeShort", () => {
  it("returns '—' for null", () => {
    expect(formatTimeShort(null)).toBe("—");
  });

  it("returns a time string for a valid ISO date", () => {
    const result = formatTimeShort(new Date().toISOString());
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("elapsedMinutes", () => {
  it("returns '00:00' for null", () => {
    expect(elapsedMinutes(null)).toBe("00:00");
  });

  it("returns '00:00' for a future date", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(elapsedMinutes(future)).toBe("00:00");
  });

  it("formats 90 minutes as '01:30'", () => {
    const past = new Date(Date.now() - 90 * 60000).toISOString();
    expect(elapsedMinutes(past)).toBe("01:30");
  });

  it("formats 5 minutes as '00:05'", () => {
    const past = new Date(Date.now() - 5 * 60000).toISOString();
    expect(elapsedMinutes(past)).toBe("00:05");
  });
});

describe("hasValidCoords", () => {
  it("returns false for null emergency", () => {
    expect(hasValidCoords(null)).toBe(false);
  });

  it("returns false when locationAnonymized is true", () => {
    expect(hasValidCoords({ locationAnonymized: true, latitude: -34, longitude: -58 })).toBe(false);
  });

  it("returns true for numeric lat/lng", () => {
    expect(hasValidCoords({ latitude: -34.6037, longitude: -58.3816 })).toBe(true);
  });

  it("returns false for non-numeric latitude", () => {
    expect(hasValidCoords({ latitude: "not-a-number", longitude: -58.3816 })).toBe(false);
  });

  it("returns false for undefined coords", () => {
    expect(hasValidCoords({ latitude: undefined, longitude: undefined })).toBe(false);
  });
});

describe("locationLabel", () => {
  it("returns 'Sin ubicación' for null", () => {
    expect(locationLabel(null)).toBe("Sin ubicación");
  });

  it("returns anonymization notice when locationAnonymized", () => {
    expect(locationLabel({ locationAnonymized: true })).toBe(
      "Ubicación anonimizada (retención)"
    );
  });

  it("prefers locationLabel field when present", () => {
    expect(locationLabel({ locationLabel: "Av. Corrientes 1234" })).toBe("Av. Corrientes 1234");
  });

  it("formats valid coords to 4 decimal places", () => {
    expect(locationLabel({ latitude: -34.6037, longitude: -58.3816 })).toBe(
      "-34.6037, -58.3816"
    );
  });

  it("returns 'Sin ubicación' when no coords available", () => {
    expect(locationLabel({})).toBe("Sin ubicación");
  });
});
