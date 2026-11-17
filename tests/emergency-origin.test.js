import { describe, it, expect } from "vitest";
import { getEmergencyOrigin } from "../app/lib/emergencyOrigin.js";

describe("getEmergencyOrigin", () => {
  it.each([
    ["RECLAMO", "Reclamo de ciclovía", "pedal_bike"],
    ["EVENTO_PUBLICO", "Cobertura preventiva por evento", "groups"],
    ["RESERVA", "Cobertura preventiva por reserva", "event_available"],
    ["EVENTO_CLIMATICO", "Alerta climática", "thunderstorm"],
    ["MOVILIDAD_BICICLETA", "Asistencia en bici", "directions_bike"],
    ["INCIDENTE_VIAL", "Incidente vial", "car_crash"],
  ])("%s → de dónde viene, con etiqueta legible", (causaTipo, label, icon) => {
    const origin = getEmergencyOrigin({ source: "EXTERNAL", causaTipo, causaId: "00b4bea5-3c1d-4e2f-9a8b-7c6d5e4f3a21" });

    expect(origin).toMatchObject({ tipo: causaTipo, label, icon });
    expect(origin.shortLabel.length).toBeLessThanOrEqual(label.length);
  });

  it("no expone el id de la causa: el único identificador es el de la emergencia", () => {
    const origin = getEmergencyOrigin({
      source: "EXTERNAL",
      causaTipo: "RECLAMO",
      causaId: "00b4bea5-3c1d-4e2f-9a8b-7c6d5e4f3a21",
      correlationId: "EMG-20261115-12345",
    });

    expect(Object.keys(origin).sort()).toEqual(["icon", "label", "shortLabel", "tipo"]);
    expect(JSON.stringify(origin)).not.toMatch(/00b4bea5|EMG-/);
  });

  it("una reportada por un ciudadano no tiene origen", () => {
    expect(getEmergencyOrigin({ source: "INTERNAL", causaTipo: null, causaId: null })).toBeNull();
    expect(getEmergencyOrigin({ userId: "CIT-1" })).toBeNull();
    expect(getEmergencyOrigin(null)).toBeNull();
  });

  it("una causa que el front no conoce, o una externa sin causa, se ve como origen externo", () => {
    expect(getEmergencyOrigin({ source: "EXTERNAL", causaTipo: "NUEVA_CAUSA" })).toMatchObject({
      tipo: "NUEVA_CAUSA",
      label: "Origen externo",
      shortLabel: "Externa",
    });
    expect(getEmergencyOrigin({ source: "EXTERNAL", causaTipo: "  " })).toMatchObject({
      tipo: null,
      label: "Origen externo",
    });
  });

  it("alcanza con causaTipo aunque no venga source", () => {
    expect(getEmergencyOrigin({ causaTipo: " RECLAMO " })).toMatchObject({
      tipo: "RECLAMO",
      label: "Reclamo de ciclovía",
    });
  });
});
