import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { clearStoredUser } = vi.hoisted(() => ({
  clearStoredUser: vi.fn(),
}));

vi.mock("../app/lib/auth.js", () => ({ clearStoredUser }));

import {
  CitizenProfileApiError,
  fetchCitizenProfile,
  saveCitizenProfile,
  fetchSavedLocations,
  createSavedLocation,
  patchSavedLocation,
  deleteSavedLocation,
} from "../app/lib/citizen-profile-api.js";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("citizen-profile-api", () => {
  beforeEach(() => {
    clearStoredUser.mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchCitizenProfile: GET y devuelve data", async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { data: { name: "Ana" } }));

    await expect(fetchCitizenProfile()).resolves.toEqual({ name: "Ana" });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/backend/api/citizen/profile",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
      })
    );
  });

  it("saveCitizenProfile: PUT con body JSON", async () => {
    global.fetch.mockResolvedValue(jsonResponse(200, { data: { name: "Ana" } }));

    await expect(saveCitizenProfile({ name: "Ana" })).resolves.toEqual({ name: "Ana" });

    const [, init] = global.fetch.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ name: "Ana" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("fetchSavedLocations: lista o [] si data no es array", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "1" }] }));
    await expect(fetchSavedLocations()).resolves.toEqual([{ id: "1" }]);

    global.fetch.mockResolvedValueOnce(jsonResponse(200, { data: null }));
    await expect(fetchSavedLocations()).resolves.toEqual([]);
  });

  it("create/patch/delete saved locations", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(200, { data: { id: "n1" } }));
    await expect(createSavedLocation({ label: "Casa" })).resolves.toEqual({ id: "n1" });

    global.fetch.mockResolvedValueOnce(jsonResponse(200, { data: { id: "n1", label: "Trabajo" } }));
    await expect(patchSavedLocation("n1", { label: "Trabajo" })).resolves.toEqual({
      id: "n1",
      label: "Trabajo",
    });

    global.fetch.mockResolvedValueOnce(jsonResponse(200, { data: true }));
    await expect(deleteSavedLocation("n1")).resolves.toBe(true);

    expect(global.fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/backend/api/citizen/saved-locations", "POST"],
      ["/api/backend/api/citizen/saved-locations/n1", "PATCH"],
      ["/api/backend/api/citizen/saved-locations/n1", "DELETE"],
    ]);
  });

  it("error HTTP: lanza CitizenProfileApiError con message del body", async () => {
    global.fetch.mockResolvedValue(jsonResponse(400, { message: "dato inválido" }));

    await expect(fetchCitizenProfile()).rejects.toMatchObject({
      name: "CitizenProfileApiError",
      status: 400,
      message: "dato inválido",
    });
    expect(clearStoredUser).not.toHaveBeenCalled();
  });

  it("401: limpia sesión, purga legacy storage y redirige a /acceso", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    const replace = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/inicio", replace },
    });
    global.fetch.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));

    await expect(fetchCitizenProfile()).rejects.toBeInstanceOf(CitizenProfileApiError);
    expect(clearStoredUser).toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalledWith("citypass_personal_data");
    expect(removeItem).toHaveBeenCalledWith("citypass_saved_locations");
    expect(replace).toHaveBeenCalledWith("/acceso");
  });

  it("401 desde /acceso: no redirige en loop", async () => {
    vi.stubGlobal("localStorage", { removeItem: vi.fn() });
    const replace = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/acceso", replace },
    });
    global.fetch.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));

    await expect(fetchCitizenProfile()).rejects.toBeInstanceOf(CitizenProfileApiError);
    expect(replace).not.toHaveBeenCalled();
  });

  it("JSON inválido: message genérico por status", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("bad json");
      },
    });

    await expect(fetchCitizenProfile()).rejects.toMatchObject({
      message: "Error HTTP 502",
      status: 502,
    });
  });
});
