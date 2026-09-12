import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getPersonalData,
  savePersonalData,
  clearPersonalData,
  PERSONAL_DATA_STORAGE_KEY,
  EMPTY_PERSONAL_DATA,
} from "../app/lib/personal-data";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("personal-data (sin localStorage)", () => {
  it("getPersonalData devuelve el objeto vacío si no hay localStorage", () => {
    expect(getPersonalData()).toEqual(EMPTY_PERSONAL_DATA);
  });

  it("savePersonalData devuelve false si no hay localStorage", () => {
    expect(savePersonalData({ name: "Juan" })).toBe(false);
  });

  it("clearPersonalData devuelve false si no hay localStorage", () => {
    expect(clearPersonalData()).toBe(false);
  });
});

describe("personal-data (con localStorage)", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("getPersonalData devuelve vacío si no se guardó nada todavía", () => {
    expect(getPersonalData()).toEqual(EMPTY_PERSONAL_DATA);
  });

  it("savePersonalData guarda y getPersonalData lo recupera", () => {
    const data = {
      name: "Juan Pérez",
      phone: "1122334455",
      emergencyContactName: "Ana Pérez",
      emergencyContactPhone: "1199887766",
      medicalCondition: "Diabetes",
    };
    expect(savePersonalData(data)).toBe(true);
    expect(getPersonalData()).toEqual(data);
  });

  it("savePersonalData completa campos faltantes con el default vacío", () => {
    savePersonalData({ name: "Solo nombre" });
    expect(getPersonalData()).toEqual({
      ...EMPTY_PERSONAL_DATA,
      name: "Solo nombre",
    });
  });

  it("clearPersonalData borra lo guardado", () => {
    savePersonalData({ name: "Temporal" });
    expect(clearPersonalData()).toBe(true);
    expect(getPersonalData()).toEqual(EMPTY_PERSONAL_DATA);
  });

  it("getPersonalData tolera JSON corrupto", () => {
    globalThis.localStorage.setItem(PERSONAL_DATA_STORAGE_KEY, "{not-json");
    expect(getPersonalData()).toEqual(EMPTY_PERSONAL_DATA);
  });

  it("getPersonalData tolera un valor guardado que no es un objeto", () => {
    globalThis.localStorage.setItem(PERSONAL_DATA_STORAGE_KEY, JSON.stringify("hola"));
    expect(getPersonalData()).toEqual(EMPTY_PERSONAL_DATA);
  });

  it("savePersonalData devuelve false si localStorage tira una excepción", () => {
    globalThis.localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(savePersonalData({ name: "X" })).toBe(false);
  });

  it("clearPersonalData devuelve false si localStorage tira una excepción", () => {
    globalThis.localStorage.removeItem = () => {
      throw new Error("boom");
    };
    expect(clearPersonalData()).toBe(false);
  });
});
