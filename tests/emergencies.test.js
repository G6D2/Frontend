import { describe, it, expect } from "vitest";
import {
  emergencyTitle,
  getStatusConfig,
  getOfficerStatusConfig,
  RETURNED_STATUS_CONFIG,
  isPendingStatus,
  isActiveStatus,
  isTerminalStatus,
  isCancelable,
  canAssignOfficer,
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
  getZoneContext,
  getPriorityElevation,
  isPriorityElevatedByIncident,
  getIncidentSummary,
  translateIncidentReasonCode,
  getEmergencyReason,
} from "../app/lib/emergencies";

describe("TYPE_LABELS", () => {
  it("tiene etiqueta para los tipos que crea solo el sistema", () => {
    expect(emergencyTitle({ emergencyType: "PREVENTIVA" })).toBe("Cobertura preventiva");
    expect(emergencyTitle({ emergencyType: "TRANSITO" })).toBe("Tránsito");
  });

  it("la descripción sigue ganando sobre la etiqueta del tipo", () => {
    expect(emergencyTitle({ emergencyType: "PREVENTIVA", description: "Cobertura preventiva — Feria" }))
      .toBe("Cobertura preventiva — Feria");
  });
});

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

describe("getOfficerStatusConfig (vista del oficial)", () => {
  it("una devuelta se muestra DEVUELTA, sin importar el estado que tenga hoy", () => {
    expect(getOfficerStatusConfig({ status: "DISPATCHED", returned: true })).toBe(RETURNED_STATUS_CONFIG);
    expect(RETURNED_STATUS_CONFIG).toMatchObject({ label: "DEVUELTA", badgeClass: "bg-gray-100 text-gray-700" });
  });

  it("el resto usa el estado de siempre", () => {
    expect(getOfficerStatusConfig({ status: "CLOSED", returned: false })).toMatchObject({ label: "CERRADA" });
    expect(getOfficerStatusConfig({ status: "RESOLVED" })).toMatchObject({ label: "RESUELTA" });
    expect(getOfficerStatusConfig(null)).toMatchObject({ label: "PENDIENTE" });
  });
});

describe("getStatusConfig", () => {
  it("returns config for known status", () => {
    expect(getStatusConfig("PENDING")).toMatchObject({ label: "PENDIENTE" });
    expect(getStatusConfig("VALIDATED")).toMatchObject({ label: "VALIDADA" });
    expect(getStatusConfig("DISCARDED")).toMatchObject({ label: "DESCARTADA" });
  });

  it("falls back to the PENDIENTE config for unknown status", () => {
    expect(getStatusConfig("UNKNOWN_XYZ")).toMatchObject({ label: "PENDIENTE" });
  });

  // ON_SCENE es el estado del backend; ON_SITE es un alias que el front
  // todavía acepta pero el backend no emite.
  it("shows EN_ROUTE / ON_SCENE (and the ON_SITE alias) labels without underscores", () => {
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
  it("returns true for PENDING and the pendiente UI alias", () => {
    expect(isPendingStatus("PENDING")).toBe(true);
    expect(isPendingStatus("pendiente")).toBe(true);
  });

  it("returns false for non-pending statuses", () => {
    expect(isPendingStatus("VALIDATED")).toBe(false);
    expect(isPendingStatus("CLOSED")).toBe(false);
    expect(isPendingStatus("DISPATCHED")).toBe(false);
  });
});

describe("canAssignOfficer", () => {
  it("solo VALIDATED puede asignarse", () => {
    expect(canAssignOfficer("VALIDATED")).toBe(true);
    expect(canAssignOfficer("PENDING")).toBe(false);
    expect(canAssignOfficer("DISPATCHED")).toBe(false);
    expect(canAssignOfficer("validada")).toBe(false);
    expect(canAssignOfficer(null)).toBe(false);
  });
});

describe("isActiveStatus", () => {
  // En el backend RESOLVED todavía no es terminal (RESOLVED → CLOSED); el
  // front igual lo trata como "no activo" para sacarlo de las vistas operativas.
  it("returns false for terminal statuses and for RESOLVED", () => {
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

describe("isTerminalStatus", () => {
  it("es true para los estados de los que la emergencia ya no sale", () => {
    for (const s of ["CANCELLED", "CLOSED", "DISCARDED"]) {
      expect(isTerminalStatus(s)).toBe(true);
    }
  });

  // RESOLVED → CLOSED: el detalle del ciudadano tiene que seguir consultando
  // para mostrar el cierre del dispatcher.
  it("es false para RESOLVED y para los estados en curso", () => {
    for (const s of ["PENDING", "VALIDATED", "DISPATCHED", "EN_ROUTE", "ON_SCENE", "RESOLVED"]) {
      expect(isTerminalStatus(s)).toBe(false);
    }
  });

  it("es false para un estado desconocido o ausente", () => {
    expect(isTerminalStatus("OTRO")).toBe(false);
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});

describe("isCancelable", () => {
  // El backend solo cancela desde PENDING o VALIDATED (src/domain/emergency-status.js).
  it("returns true for PENDING and VALIDATED", () => {
    expect(isCancelable("PENDING")).toBe(true);
    expect(isCancelable("VALIDATED")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isCancelable("DISPATCHED")).toBe(false);
    expect(isCancelable("CLOSED")).toBe(false);
    expect(isCancelable("DISCARDED")).toBe(false);
  });
});

// CREATED NO es un estado del backend: era el default de la columna en la
// migración V1 y V5 lo cambió a PENDING. EMERGENCY_STATUSES no lo incluye y
// cualquier transición desde CREATED responde 409 ("Unknown emergency status").
// El front lo sigue aceptando para pintar filas viejas; estos tests documentan
// esa tolerancia, no un estado válido.
describe("CREATED (legado de V1, el backend no lo conoce)", () => {
  it("se pinta como pendiente", () => {
    expect(isPendingStatus("CREATED")).toBe(true);
    expect(getStatusConfig("CREATED")).toMatchObject({ label: "PENDIENTE" });
    expect(canAssignOfficer("CREATED")).toBe(false);
  });

  it("isCancelable lo da por cancelable, pero el backend respondería 409", () => {
    expect(isCancelable("CREATED")).toBe(true);
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

  it("prefers dispatchPriority (zone context) over effectivePriority and severity", () => {
    expect(
      getEffectivePriority({
        severity: "medium",
        effectivePriority: "high",
        dispatchPriority: "critical",
      })
    ).toBe("critical");
  });
});

describe("getZoneContext", () => {
  it("returns null without a priorityContext (the normal case)", () => {
    expect(getZoneContext(null)).toBeNull();
    expect(getZoneContext({})).toBeNull();
    expect(getZoneContext({ priorityContext: null })).toBeNull();
    expect(getZoneContext({ priorityContext: "x" })).toBeNull();
    expect(getZoneContext({ priorityContext: {} })).toBeNull();
  });

  it("describes a public-event context with barrio and event name", () => {
    const context = getZoneContext({
      priorityContext: {
        tipo: "EVENTO_ESPACIO_PUBLICO",
        barrio: "VILLA DEL PARQUE",
        descripcion: "Recital en la plaza",
        vigenteHasta: "2026-11-21T23:00:00.000Z",
      },
    });
    expect(context).toEqual({
      tipo: "EVENTO_ESPACIO_PUBLICO",
      label: "Evento en la zona",
      barrio: "Villa del Parque",
      descripcion: "Recital en la plaza",
      vigenteHasta: "2026-11-21T23:00:00.000Z",
      reason: "Prioridad elevada: evento en la zona (Villa del Parque) · Recital en la plaza",
    });
  });

  it("describes a public-event context by radius, without barrio (backend #96)", () => {
    const context = getZoneContext({
      barrio: "PALERMO",
      priorityContext: {
        tipo: "EVENTO_ESPACIO_PUBLICO",
        radioMetros: 500,
        descripcion: "Feria en el parque",
      },
    });
    expect(context.barrio).toBeNull();
    expect(context.reason).toBe("Prioridad elevada: evento en la zona · Feria en el parque");
  });

  it("describes a climate alert with the backend description (ADR #39 format), without barrio", () => {
    // priorityContext tal como lo arma el backend para un punto de una alerta.
    const context = getZoneContext({
      barrio: "SAN NICOLAS",
      priorityContext: {
        tipo: "ALERTA_CLIMATICA",
        latitud: -34.6037,
        longitud: -58.3816,
        radioMetros: 1000,
        origen: "espacios",
        referenciaExterna: "a7f0e2c4-1b3d-4e5f-8a9b-0c1d2e3f4a5b#0",
        descripcion: "Alerta climática CRITICA: tormenta fuerte",
        vigenteDesde: "2026-11-12T21:00:00.000Z",
        vigenteHasta: "2026-11-13T03:00:00.000Z",
      },
    });
    expect(context).toEqual({
      tipo: "ALERTA_CLIMATICA",
      label: "Alerta climática",
      barrio: null,
      descripcion: "Alerta climática CRITICA: tormenta fuerte",
      vigenteHasta: "2026-11-13T03:00:00.000Z",
      reason: "Prioridad elevada por alerta climática CRITICA: tormenta fuerte",
    });
  });

  it("is null-safe with missing barrio, description and unknown type", () => {
    expect(getZoneContext({ priorityContext: { tipo: "ALERTA_CLIMATICA" } })).toEqual({
      tipo: "ALERTA_CLIMATICA",
      label: "Alerta climática",
      barrio: null,
      descripcion: null,
      vigenteHasta: null,
      reason: "Prioridad elevada por alerta climática",
    });
    expect(getZoneContext({ priorityContext: { tipo: "OTRO", barrio: 7 } }).label).toBe(
      "Contexto de zona"
    );
  });
});

describe("isPriorityElevatedByIncident", () => {
  it("returns false for a null emergency", () => {
    expect(isPriorityElevatedByIncident(null)).toBe(false);
  });

  it("does not count a zone-context raise as an incident raise", () => {
    expect(
      isPriorityElevatedByIncident({
        severity: "medium",
        effectivePriority: "medium",
        dispatchPriority: "high",
      })
    ).toBe(false);
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

// Tarjeta del oficial (/oficial): la suba entera en una línea.
describe("getPriorityElevation", () => {
  const climateAlert = {
    tipo: "ALERTA_CLIMATICA",
    descripcion: "Alerta climática CRITICA: tormenta fuerte",
  };
  const publicEvent = { tipo: "EVENTO_ESPACIO_PUBLICO", descripcion: "Recital en la plaza" };

  it("returns null for a null emergency", () => {
    expect(getPriorityElevation(null)).toBeNull();
  });

  it("returns null when the backend only sends severity (lo que recibe hoy el oficial)", () => {
    expect(getPriorityElevation({ severity: "medium" })).toBeNull();
  });

  it("returns null when the dispatch priority equals the severity", () => {
    expect(
      getPriorityElevation({
        severity: "high",
        effectivePriority: "high",
        dispatchPriority: "high",
        priorityContext: null,
      })
    ).toBeNull();
  });

  it("explains a raise by a climate alert, with the full reason as detail", () => {
    expect(
      getPriorityElevation({
        severity: "medium",
        effectivePriority: "medium",
        dispatchPriority: "high",
        priorityContext: climateAlert,
      })
    ).toEqual({
      priority: "high",
      original: "medium",
      originalLabel: "Media",
      reason: "Prioridad elevada por alerta climática (era Media)",
      detail: "Prioridad elevada por alerta climática CRITICA: tormenta fuerte",
    });
  });

  it("explains a raise by a public event in the zone", () => {
    const elevation = getPriorityElevation({
      severity: "low",
      effectivePriority: "low",
      dispatchPriority: "medium",
      priorityContext: publicEvent,
    });
    expect(elevation.reason).toBe("Prioridad elevada por evento en la zona (era Baja)");
    expect(elevation.detail).toBe("Prioridad elevada: evento en la zona · Recital en la plaza");
  });

  it("explains a raise by an incident, without detail", () => {
    expect(
      getPriorityElevation({
        severity: "medium",
        effectivePriority: "critical",
        dispatchPriority: "critical",
        priorityContext: null,
      })
    ).toMatchObject({
      priority: "critical",
      reason: "Prioridad elevada por incidente (era Media)",
      detail: null,
    });
  });

  it("names both causes when the incident and the zone context raise it", () => {
    expect(
      getPriorityElevation({
        severity: "medium",
        effectivePriority: "high",
        dispatchPriority: "critical",
        priorityContext: climateAlert,
      }).reason
    ).toBe("Prioridad elevada por incidente y alerta climática (era Media)");
  });

  it("does not name a zone context that did not raise anything (ya estaba en Crítica)", () => {
    const elevation = getPriorityElevation({
      severity: "high",
      effectivePriority: "critical",
      dispatchPriority: "critical",
      priorityContext: publicEvent,
    });
    expect(elevation.reason).toBe("Prioridad elevada por incidente (era Alta)");
    expect(elevation.detail).toBeNull();
  });

  it("counts the zone context when effectivePriority does not come", () => {
    expect(
      getPriorityElevation({
        severity: "medium",
        dispatchPriority: "high",
        priorityContext: climateAlert,
      }).reason
    ).toBe("Prioridad elevada por alerta climática (era Media)");
  });

  it("still says it was raised when no cause comes with it", () => {
    expect(
      getPriorityElevation({ severity: "medium", dispatchPriority: "high" }).reason
    ).toBe("Prioridad elevada (era Media)");
  });

  it("returns null for a lower or unknown priority", () => {
    expect(getPriorityElevation({ severity: "critical", dispatchPriority: "low" })).toBeNull();
    expect(getPriorityElevation({ severity: "no-existe", dispatchPriority: "high" })).toBeNull();
    expect(getPriorityElevation({ severity: "medium", dispatchPriority: "urgente" })).toBeNull();
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
