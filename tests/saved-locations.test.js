import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  fetchSavedLocations,
  createSavedLocation,
  patchSavedLocation,
  deleteSavedLocation,
} = vi.hoisted(() => ({
  fetchSavedLocations: vi.fn(),
  createSavedLocation: vi.fn(),
  patchSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
}));

vi.mock("../app/lib/citizen-profile-api.js", () => ({
  fetchSavedLocations,
  createSavedLocation,
  patchSavedLocation,
  deleteSavedLocation,
}));

import {
  getSavedLocations,
  addSavedLocation,
  updateSavedLocation,
  removeSavedLocation,
  clearSavedLocations,
  SAVED_LOCATIONS_STORAGE_KEY,
} from "../app/lib/saved-locations.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("saved-locations (backend)", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    fetchSavedLocations.mockReset();
    createSavedLocation.mockReset();
    patchSavedLocation.mockReset();
    deleteSavedLocation.mockReset();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("getSavedLocations pide al backend y purga localStorage legacy", async () => {
    globalThis.localStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, "[]");
    fetchSavedLocations.mockResolvedValue([{ id: "1", label: "Casa", address: "A" }]);
    await expect(getSavedLocations()).resolves.toHaveLength(1);
    expect(globalThis.localStorage.getItem(SAVED_LOCATIONS_STORAGE_KEY)).toBeNull();
  });

  it("add/update/remove delegan en el API", async () => {
    createSavedLocation.mockResolvedValue({ id: "1", label: "Casa" });
    patchSavedLocation.mockResolvedValue({ id: "1", label: "Trabajo" });
    deleteSavedLocation.mockResolvedValue(true);

    await expect(addSavedLocation({ label: "Casa", address: "A" })).resolves.toMatchObject({
      id: "1",
    });
    await expect(updateSavedLocation("1", { label: "Trabajo" })).resolves.toBe(true);
    await expect(removeSavedLocation("1")).resolves.toBe(true);
    expect(patchSavedLocation).toHaveBeenCalledWith("1", { label: "Trabajo" });
    expect(deleteSavedLocation).toHaveBeenCalledWith("1");
  });

  it("clearSavedLocations solo limpia restos locales", () => {
    globalThis.localStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, "[]");
    expect(clearSavedLocations()).toBe(true);
    expect(globalThis.localStorage.getItem(SAVED_LOCATIONS_STORAGE_KEY)).toBeNull();
  });
});
