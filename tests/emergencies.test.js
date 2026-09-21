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
  priorityDotClass,
  priorityTextClass,
  getEffectivePriority,
  isPriorityElevatedByIncident,
  getIncidentSummary,
  translateIncidentReasonCode,
  getEmergencyReason,
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

// Regresión: el punto de color de /ops/mapa y el texto resaltado de
// /ops/lista armaban `var(--color-${cfg.color})` en runtime. Tailwind v4
// solo emite a :root las variables de @theme usadas como clase Tailwind
// literal en el código, así que --color-priority-high/-med/-low quedaban
// afuera del CSS compilado y el color no se veía (bug real: "prueba
// severidad derivada", severity "high"). priorityDotClass/priorityTextClass
// devuelven clases Tailwind estáticas para evitar que vuelva a pasar.
describe("priorityDotClass / priorityTextClass (clases estáticas, no armadas en runtime)", () => {
  it("da una clase distinta y no vacía a cada severidad conocida", () => {
    const severities = ["critical", "high", "medium", "low"];
    const dotClasses = severities.map(priorityDotClass);
    const textClasses = severities.map(priorityTextClass);
    for (const cls of [...dotClasses, ...textClasses]) {
      expect(cls).toBeTruthy();
      expect(cls).not.toMatch(/\$\{/);
    }
    expect(new Set(dotClasses).size).toBe(severities.length);
    expect(new Set(textClasses).size).toBe(severities.length);
  });

  it("nunca devuelve una clase vacía para severidades desconocidas (fallback gris)", () => {
    expect(priorityDotClass("no-existe")).toContain("bg-gray");
    expect(priorityDotClass(undefined)).toContain("bg-gray");
    expect(priorityTextClass("no-existe")).toContain("text-gray");
    expect(priorityTextClass(undefined)).toContain("text-gray");
  });

  it("pinta 'high' en naranja, distinto de 'critical' (rojo)", () => {
    expect(priorityDotClass("high")).toMatch(/orange/);
    expect(priorityDotClass("critical")).toMatch(/red/);
    expect(priorityTextClass("high")).toMatch(/orange/);
    expect(priorityTextClass("critical")).toMatch(/red/);
  });
});

// Contrato 2026-09 (PR en curso en emergencias-backend, todavía NO en
// producción): effectivePriority/incident. Todo esto tiene que ser
// null-safe: no debe romper si el campo no viene (backend actual).
describe("getEffectivePriority", () => {
  it("returns null for a null emergency", () => {
    expect(getEffectivePriority(null)).toBeNull();
  });

  it("falls back to severity when effectivePriority is missing (backend actual)", () => {
    expect(getEffectivePriority({ severity: "high" })).toBe("high");
  });

  it("prefers effectivePriority when the backend sends it", () => {
    expect(
      getEffectivePriority({ severity: "medium", effectivePriority: "critical" })
    ).toBe("critical");
  });

  it("returns null when neither field is present", () => {
    expect(getEffectivePriority({})).toBeNull();
  });
});

describe("isPriorityElevatedByIncident", () => {
  it("returns false for a null emergency", () => {
    expect(isPriorityElevatedByIncident(null)).toBe(false);
  });

  it("returns false when there is no effectivePriority (backend actual)", () => {
    expect(isPriorityElevatedByIncident({ severity: "medium" })).toBe(false);
  });

  it("returns false when effectivePriority equals severity", () => {
    expect(
      isPriorityElevatedByIncident({ severity: "high", effectivePriority: "high" })
    ).toBe(false);
  });

  it("returns true when effectivePriority ranks above severity", () => {
    expect(
      isPriorityElevatedByIncident({ severity: "medium", effectivePriority: "critical" })
    ).toBe(true);
  });

  it("returns false when effectivePriority ranks below severity (no debería pasar, pero no debe crashear)", () => {
    expect(
      isPriorityElevatedByIncident({ severity: "critical", effectivePriority: "low" })
    ).toBe(false);
  });

  it("returns false for unknown severity/priority values", () => {
    expect(
      isPriorityElevatedByIncident({ severity: "no-existe", effectivePriority: "critical" })
    ).toBe(false);
  });
});

describe("getIncidentSummary", () => {
  it("returns null when there is no incident field (backend actual)", () => {
    expect(getIncidentSummary({ id: "e1" })).toBeNull();
  });

  it("returns null when incident is explicitly null", () => {
    expect(getIncidentSummary({ incident: null })).toBeNull();
  });

  it("returns null for a null/undefined emergency", () => {
    expect(getIncidentSummary(null)).toBeNull();
    expect(getIncidentSummary(undefined)).toBeNull();
  });

  it("normalizes a full incident object", () => {
    const summary = getIncidentSummary({
      incident: {
        id: "inc-1",
        priority: "high",
        score: 72,
        reportCount: 4,
        uniqueCitizens: 3,
        reasonCodes: ["MULTIPLE_REPORTS", "CLOSE_PROXIMITY"],
      },
    });
    expect(summary).toEqual({
      id: "inc-1",
      priority: "high",
      score: 72,
      reportCount: 4,
      uniqueCitizens: 3,
      reasonCodes: ["MULTIPLE_REPORTS", "CLOSE_PROXIMITY"],
    });
  });

  it("defaults missing numeric/array fields without crashing", () => {
    const summary = getIncidentSummary({ incident: { id: "inc-2" } });
    expect(summary).toEqual({
      id: "inc-2",
      priority: null,
      score: null,
      reportCount: null,
      uniqueCitizens: null,
      reasonCodes: [],
    });
  });
});

describe("translateIncidentReasonCode", () => {
  it("returns empty string for falsy input", () => {
    expect(translateIncidentReasonCode(null)).toBe("");
    expect(translateIncidentReasonCode(undefined)).toBe("");
  });

  it("translates known codes from the contract example", () => {
    expect(translateIncidentReasonCode("MULTIPLE_REPORTS")).toBe("Múltiples reportes");
    expect(translateIncidentReasonCode("CLOSE_PROXIMITY")).toBe(
      "Reportes cercanos entre sí"
    );
  });

  it("translates known codes from the in-progress backend implementation", () => {
    expect(translateIncidentReasonCode("MULTI_REPORT_THRESHOLD")).toBe(
      "Múltiples reportes"
    );
    expect(translateIncidentReasonCode("PROXIMITY_CLUSTER")).toBe(
      "Reportes cercanos entre sí"
    );
    expect(translateIncidentReasonCode("UNIQUE_CITIZENS_THRESHOLD")).toBe(
      "Reportado por varios ciudadanos"
    );
  });

  it("falls back to a readable version of an unknown code", () => {
    expect(translateIncidentReasonCode("SOME_NEW_CODE")).toBe("some new code");
  });
});

describe("getEmergencyReason", () => {
  it("returns null for a null emergency", () => {
    expect(getEmergencyReason(null)).toBeNull();
  });

  it("returns null when there is nothing to show (backend actual, sin campo directo)", () => {
    expect(getEmergencyReason({ id: "e1", status: "CLOSED" })).toBeNull();
  });

  it("prefers discardReason when present", () => {
    expect(getEmergencyReason({ discardReason: "Falsa alarma" })).toBe("Falsa alarma");
  });

  it("falls back to closeReason", () => {
    expect(getEmergencyReason({ closeReason: "Atendida por SAME" })).toBe(
      "Atendida por SAME"
    );
  });

  it("falls back to a generic reason field", () => {
    expect(getEmergencyReason({ reason: "Duplicada" })).toBe("Duplicada");
  });

  it("ignores blank direct fields and falls back to statusHistory", () => {
    const emergency = {
      discardReason: "   ",
      statusHistory: [
        { newStatus: "VALIDATED", reason: null },
        { newStatus: "DISCARDED", reason: "Sin necesidad de intervención" },
      ],
    };
    expect(getEmergencyReason(emergency)).toBe("Sin necesidad de intervención");
  });

  it("takes the last entry with a reason in statusHistory", () => {
    const emergency = {
      statusHistory: [
        { newStatus: "VALIDATED", reason: "primer motivo" },
        { newStatus: "CLOSED", reason: "motivo final" },
      ],
    };
    expect(getEmergencyReason(emergency)).toBe("motivo final");
  });

  it("returns null when statusHistory has no reason at all", () => {
    const emergency = {
      statusHistory: [{ newStatus: "VALIDATED", reason: null }],
    };
    expect(getEmergencyReason(emergency)).toBeNull();
  });
});
