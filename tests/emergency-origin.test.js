import { describe, it, expect } from "vitest";
import { getEmergencyOrigin, shortCausaId } from "../app/lib/emergencyOrigin.js";

describe("shortCausaId", () => {
  it("de un UUID deja los 8 primeros caracteres en minúscula", () => {
    expect(shortCausaId("00B4BEA5-3C1D-4E2F-9A8B-7C6D5E4F3A21")).toBe("00b4bea5");
  });

  it("un id que no es UUID va completo, sin espacios alrededor", () => {
    expect(shortCausaId(" EMG-20261115-12345 ")).toBe("EMG-20261115-12345");
    expect(shortCausaId("res-700")).toBe("res-700");
  });

  it("un id largo se corta en 20 caracteres con …", () => {
    const short = shortCausaId("evento-espacios-2026-11-21-plaza-de-mayo");
    expect(short).toBe("evento-espacios-202…");
    expect(short).toHaveLength(20);
  });

  it("sin id devuelve un string vacío", () => {
    expect(shortCausaId(null)).toBe("");
    expect(shortCausaId(undefined)).toBe("");
  });
});

describe("getEmergencyOrigin", () => {
  it.each([
    ["RECLAMO", "00b4bea5-3c1d-4e2f-9a8b-7c6d5e4f3a21", "Reclamo de ciclovía", "Reclamo 00b4bea5", "pedal_bike"],
    ["EVENTO_PUBLICO", "7f3e2a10-8b4c-4d5e-a6f7-1b2c3d4e5f60", "Cobertura preventiva por evento o actividad", "Evento/actividad 7f3e2a10", "groups"],
    ["RESERVA", "res-700", "Cobertura preventiva por reserva de espacio", "Reserva res-700", "event_available"],
    ["EVENTO_CLIMATICO", "a7f0e2c4-1b3d-4e5f-8a9b-0c1d2e3f4a5b", "Alerta climática", "Alerta a7f0e2c4", "thunderstorm"],
    ["MOVILIDAD_BICICLETA", "EMG-20261115-12345", "Pedido de asistencia en bici", "Pedido EMG-20261115-12345", "directions_bike"],
    ["INCIDENTE_VIAL", "iv-1", "Incidente vial", "Incidente iv-1", "car_crash"],
  ])("%s → etiqueta legible y referencia corta", (causaTipo, causaId, label, reference, icon) => {
    const origin = getEmergencyOrigin({ source: "EXTERNAL", causaTipo, causaId });

    expect(origin).toMatchObject({ tipo: causaTipo, label, reference, icon, causaId });
    expect(typeof origin.shortLabel).toBe("string");
    expect(origin.shortLabel.length).toBeLessThanOrEqual(label.length);
  });

  it("una reportada por un ciudadano no tiene origen", () => {
    expect(getEmergencyOrigin({ source: "INTERNAL", causaTipo: null, causaId: null })).toBeNull();
    expect(getEmergencyOrigin({ userId: "CIT-1" })).toBeNull();
    expect(getEmergencyOrigin(null)).toBeNull();
  });

  it("una causa que el front no conoce se muestra como origen externo con su referencia", () => {
    expect(getEmergencyOrigin({ source: "EXTERNAL", causaTipo: "NUEVA_CAUSA", causaId: "x-1" })).toMatchObject({
      tipo: "NUEVA_CAUSA",
      label: "Origen externo",
      shortLabel: "Externa",
      reference: "Referencia x-1",
    });
  });

  it("una externa sin causa se marca igual, sin referencia", () => {
    expect(getEmergencyOrigin({ source: "EXTERNAL", causaTipo: null, causaId: "  " })).toMatchObject({
      tipo: null,
      label: "Origen externo",
      causaId: null,
      reference: null,
    });
  });

  it("alcanza con causaTipo aunque no venga source", () => {
    expect(getEmergencyOrigin({ causaTipo: " RECLAMO ", causaId: "r-1" })).toMatchObject({
      tipo: "RECLAMO",
      reference: "Reclamo r-1",
    });
  });
});
