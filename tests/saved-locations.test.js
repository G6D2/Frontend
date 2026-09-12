import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSavedLocations,
  addSavedLocation,
  updateSavedLocation,
  removeSavedLocation,
} from "../app/lib/saved-locations";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("saved-locations (sin localStorage)", () => {
  it("getSavedLocations devuelve [] si no hay localStorage", () => {
    expect(getSavedLocations()).toEqual([]);
  });

  it("addSavedLocation devuelve null si no hay localStorage", () => {
    expect(addSavedLocation({ label: "Casa" })).toBeNull();
  });

  it("updateSavedLocation devuelve false si no hay localStorage", () => {
    expect(updateSavedLocation("x", { label: "Y" })).toBe(false);
  });

  it("removeSavedLocation devuelve false si no hay localStorage", () => {
    expect(removeSavedLocation("x")).toBe(false);
  });
});

describe("saved-locations (con localStorage)", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("getSavedLocations devuelve [] cuando no hay nada guardado", () => {
    expect(getSavedLocations()).toEqual([]);
  });

  it("addSavedLocation agrega una entrada con id generado", () => {
    const entry = addSavedLocation({
      label: "Casa",
      address: "Av. Siempre Viva 742",
      lat: -34.6,
      lng: -58.4,
    });
    expect(entry).toMatchObject({
      label: "Casa",
      address: "Av. Siempre Viva 742",
      lat: -34.6,
      lng: -58.4,
    });
    expect(typeof entry.id).toBe("string");
    expect(getSavedLocations()).toHaveLength(1);
  });

  it("addSavedLocation normaliza lat/lng inválidos a null", () => {
    const entry = addSavedLocation({ label: "Trabajo", address: "Calle 1", lat: NaN, lng: "no-num" });
    expect(entry.lat).toBeNull();
    expect(entry.lng).toBeNull();
  });

  it("addSavedLocation acumula varias ubicaciones", () => {
    addSavedLocation({ label: "Casa", address: "A" });
    addSavedLocation({ label: "Trabajo", address: "B" });
    expect(getSavedLocations()).toHaveLength(2);
  });

  it("updateSavedLocation modifica una entrada existente sin cambiar el id", () => {
    const entry = addSavedLocation({ label: "Casa", address: "Vieja" });
    const ok = updateSavedLocation(entry.id, { address: "Nueva" });
    expect(ok).toBe(true);
    const [updated] = getSavedLocations();
    expect(updated.id).toBe(entry.id);
    expect(updated.address).toBe("Nueva");
  });

  it("updateSavedLocation devuelve false si el id no existe", () => {
    expect(updateSavedLocation("inexistente", { address: "X" })).toBe(false);
  });

  it("removeSavedLocation borra la entrada indicada", () => {
    const a = addSavedLocation({ label: "Casa", address: "A" });
    const b = addSavedLocation({ label: "Trabajo", address: "B" });
    expect(removeSavedLocation(a.id)).toBe(true);
    const remaining = getSavedLocations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });

  it("getSavedLocations tolera JSON corrupto", () => {
    globalThis.localStorage.setItem("citypass_saved_locations", "{not-json");
    expect(getSavedLocations()).toEqual([]);
  });

  it("getSavedLocations tolera un valor guardado que no es un array", () => {
    globalThis.localStorage.setItem("citypass_saved_locations", JSON.stringify({ foo: "bar" }));
    expect(getSavedLocations()).toEqual([]);
  });

  it("addSavedLocation devuelve null si localStorage tira una excepción al guardar", () => {
    globalThis.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(addSavedLocation({ label: "Casa" })).toBeNull();
  });
});
