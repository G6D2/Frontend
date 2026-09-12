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
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
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

  it("shows EN_ROUTE / ON_SITE labels without underscores", () => {
    expect(getStatusConfig("EN_ROUTE")).toMatchObject({ label: "EN CAMINO" });
    expect(getStatusConfig("en_camino")).toMatchObject({ label: "EN CAMINO" });
    expect(getStatusConfig("ON_SITE")).toMatchObject({ label: "EN LUGAR" });
    expect(getStatusConfig("ON_SCENE")).toMatchObject({ label: "EN LUGAR" });
    expect(getStatusConfig("en_lugar")).toMatchObject({ label: "EN LUGAR" });
  });

  it("keeps the underscored key/value untouched (only the label changes)", () => {
    expect(getStatusConfig("EN_ROUTE").key).toBe("en_camino");
    expect(getStatusConfig("ON_SITE").key).toBe("en_lugar");
  });

  it("gives each status family a badgeClass with solid tenue bg + dark text", () => {
    expect(getStatusConfig("PENDING").badgeClass).toBe("bg-amber-100 text-amber-900");
    expect(getStatusConfig("VALIDATED").badgeClass).toBe("bg-green-100 text-green-800");
    expect(getStatusConfig("DISPATCHED").badgeClass).toBe("bg-blue-100 text-blue-800");
    expect(getStatusConfig("EN_ROUTE").badgeClass).toBe("bg-blue-100 text-blue-800");
    expect(getStatusConfig("ON_SITE").badgeClass).toBe("bg-green-100 text-green-800");
  });

  it("groups terminal statuses (cancelada/cerrada/descartada) under the gray badge", () => {
    for (const status of ["CANCELLED", "CLOSED", "DISCARDED", "cancelada"]) {
      expect(getStatusConfig(status)).toMatchObject({
        color: "status-terminal",
        badgeClass: "bg-gray-100 text-gray-700",
      });
    }
  });

  it("never reuses the pendiente (amber) color for terminal statuses", () => {
    for (const status of ["CANCELLED", "CLOSED", "DISCARDED"]) {
      expect(getStatusConfig(status).color).not.toBe("status-pendiente");
    }
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

  // Regresión: Number(null) === 0 y Number.isFinite(0) === true, así que sin
  // el chequeo explícito de null/undefined una emergencia sin ubicación
  // (latitude/longitude null, como manda el backend) pasaba como "coords
  // válidas" (0,0) y se geocodificaba como "océano Atlántico".
  it("returns false for null lat/lng (no confunde null con 0,0)", () => {
    expect(hasValidCoords({ latitude: null, longitude: null })).toBe(false);
    expect(hasValidCoords({ latitude: null, longitude: -58.3816 })).toBe(false);
    expect(hasValidCoords({ latitude: -34.6037, longitude: null })).toBe(false);
  });

  it("returns false when locationUnavailable is true, aunque haya lat/lng", () => {
    expect(
      hasValidCoords({ locationUnavailable: true, latitude: -34.6037, longitude: -58.3816 })
    ).toBe(false);
  });

  it("distingue (0,0) real (numérico) de la ausencia de coords (null)", () => {
    expect(hasValidCoords({ latitude: 0, longitude: 0 })).toBe(true);
    expect(hasValidCoords({ latitude: null, longitude: null })).toBe(false);
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

  it("returns 'Sin ubicación' for null lat/lng instead of geocoding (0,0)", () => {
    expect(locationLabel({ latitude: null, longitude: null })).toBe("Sin ubicación");
  });

  it("returns 'Sin ubicación' when locationUnavailable is true", () => {
    expect(locationLabel({ locationUnavailable: true })).toBe("Sin ubicación");
  });
});

describe("PRIORITY_CONFIG (deriva de SEVERITY_CONFIG)", () => {
  it("da labels distintos a critical y high (antes ambos eran 'ALTA')", () => {
    expect(PRIORITY_CONFIG.critical.label).toBe("CRÍTICA");
    expect(PRIORITY_CONFIG.high.label).toBe("ALTA");
    expect(PRIORITY_CONFIG.critical.label).not.toBe(PRIORITY_CONFIG.high.label);
  });

  it("da colores/badgeClass distintos a critical (rojo) y high (naranja)", () => {
    expect(PRIORITY_CONFIG.critical.badgeClass).toBe("bg-red-100 text-red-800");
    expect(PRIORITY_CONFIG.high.badgeClass).toBe("bg-orange-100 text-orange-800");
    expect(PRIORITY_CONFIG.critical.color).not.toBe(PRIORITY_CONFIG.high.color);
  });

  it("mantiene medium (MEDIA) y low (BAJA) distintos de high/critical", () => {
    expect(PRIORITY_CONFIG.medium.label).toBe("MEDIA");
    expect(PRIORITY_CONFIG.low.label).toBe("BAJA");
  });

  it("es consistente con SEVERITY_CONFIG (misma severidad, mismo color semántico)", () => {
    for (const key of Object.keys(SEVERITY_CONFIG)) {
      expect(PRIORITY_CONFIG[key].label.toLowerCase()).toBe(SEVERITY_CONFIG[key].label.toLowerCase());
    }
  });
});
