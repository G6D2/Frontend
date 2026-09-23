import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fetchCitizenProfile, saveCitizenProfile } = vi.hoisted(() => ({
  fetchCitizenProfile: vi.fn(),
  saveCitizenProfile: vi.fn(),
}));

vi.mock("../app/lib/citizen-profile-api.js", () => ({
  fetchCitizenProfile,
  saveCitizenProfile,
}));

import {
  getPersonalData,
  savePersonalData,
  clearPersonalData,
  PERSONAL_DATA_STORAGE_KEY,
  EMPTY_PERSONAL_DATA,
} from "../app/lib/personal-data.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("personal-data (backend)", () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
    fetchCitizenProfile.mockReset();
    saveCitizenProfile.mockReset();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("getPersonalData pide el perfil al backend y purga localStorage legacy", async () => {
    globalThis.localStorage.setItem(PERSONAL_DATA_STORAGE_KEY, '{"name":"Legacy"}');
    fetchCitizenProfile.mockResolvedValue({
      name: "Juan",
      phone: "11",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalCondition: "",
    });

    await expect(getPersonalData()).resolves.toMatchObject({ name: "Juan", phone: "11" });
    expect(globalThis.localStorage.getItem(PERSONAL_DATA_STORAGE_KEY)).toBeNull();
  });

  it("savePersonalData envía el perfil al backend", async () => {
    saveCitizenProfile.mockResolvedValue({ name: "Ana" });
    await expect(savePersonalData({ name: "Ana" })).resolves.toBe(true);
    expect(saveCitizenProfile).toHaveBeenCalledWith({ name: "Ana" });
  });

  it("clearPersonalData solo limpia restos locales", () => {
    globalThis.localStorage.setItem(PERSONAL_DATA_STORAGE_KEY, "{}");
    expect(clearPersonalData()).toBe(true);
    expect(globalThis.localStorage.getItem(PERSONAL_DATA_STORAGE_KEY)).toBeNull();
    expect(EMPTY_PERSONAL_DATA.name).toBe("");
  });
});
