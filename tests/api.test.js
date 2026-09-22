import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  POLLING_INTERVAL_MS,
  CITIZEN_POLLING_INTERVAL_MS,
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  ApiError,
  loginDev,
  logout,
  fetchCurrentUser,
  hasValidSession,
  triggerPanicButton,
  fetchEmergencyDetail,
  fetchEmergencies,
  fetchEmergenciesPage,
  cancelEmergency,
  reportIncident,
  validateEmergency,
  discardEmergency,
  overridePriority,
  fetchOfficers,
  assignOfficer,
  updateEmergencyStatus,
  addObservation,
  requestReinforcements,
  fetchEmergencyHistory,
  getStoredUser,
  setStoredUser,
  clearSession,
} from "../app/lib/api.js";

describe("api.js", () => {
  let originalWindow;
  let originalFetch;
  let mockSessionStorage;

  beforeEach(() => {
    originalWindow = global.window;
    originalFetch = global.fetch;

    const store = new Map();
    mockSessionStorage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, val) => store.set(key, String(val))),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    };

    global.window = {
      location: {
        pathname: "/dashboard",
        replace: vi.fn(),
      },
      sessionStorage: mockSessionStorage,
    };
    global.sessionStorage = mockSessionStorage;
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
    delete global.sessionStorage;
    vi.restoreAllMocks();
  });

  describe("Constantes exportadas", () => {
    it("define intervalos de polling esperados", () => {
      expect(POLLING_INTERVAL_MS).toBe(60000);
      expect(CITIZEN_POLLING_INTERVAL_MS).toBe(5000);
    });

    it("define la configuración de estados y severidades", () => {
      expect(Array.isArray(STATUS_CONFIG)).toBe(true);
      expect(STATUS_CONFIG.length).toBeGreaterThan(0);
      expect(STATUS_CONFIG[0]).toHaveProperty("key");
      expect(STATUS_CONFIG[0]).toHaveProperty("label");
      expect(STATUS_CONFIG[0]).toHaveProperty("color");
      expect(SEVERITY_CONFIG).toBeDefined();
    });
  });

  describe("ApiError", () => {
    it("crea un error con status y body opcionales", () => {
      const err = new ApiError("Mensaje de fallo", { status: 404, body: { detail: "no encontrado" } });
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("ApiError");
      expect(err.message).toBe("Mensaje de fallo");
      expect(err.status).toBe(404);
      expect(err.body).toEqual({ detail: "no encontrado" });
    });
  });

  describe("Auth & Sesión", () => {
    it("loginDev: envía POST /api/auth/login, guarda usuario y método de login", async () => {
      const fakeResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          user: { sub: "u1", username: "juan" },
        }),
      };
      global.fetch = vi.fn().mockResolvedValue(fakeResponse);

      const result = await loginDev({
        sub: "u1",
        preferred_username: "juan",
        groups: ["citizen"],
        hasAntipanicButton: true,
        loginMethod: "directo",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          body: JSON.stringify({
            sub: "u1",
            preferred_username: "juan",
            groups: ["citizen"],
            hasAntipanicButton: true,
          }),
        })
      );
      expect(result.user).toEqual({ sub: "u1", username: "juan", loginMethod: "directo" });
      expect(getStoredUser()).toEqual({ sub: "u1", username: "juan", loginMethod: "directo" });
    });

    it("loginDev: lanza ApiError si el login falla", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Credenciales inválidas" }),
      });

      await expect(loginDev({ sub: "bad" })).rejects.toThrow(ApiError);
    });

    it("logout: llama a /api/auth/logout y limpia usuario almacenado", async () => {
      setStoredUser({ sub: "u1" });
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST", credentials: "same-origin" })
      );
      expect(getStoredUser()).toBeNull();
    });

    it("fetchCurrentUser: obtiene sesión de /api/auth/session y fusiona con perfil local", async () => {
      setStoredUser({ sub: "u1", customPref: "dark" });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { sub: "u1", email: "test@city.com" } }),
      });

      const user = await fetchCurrentUser();

      expect(user).toEqual({ sub: "u1", customPref: "dark", email: "test@city.com" });
      expect(getStoredUser()).toEqual(user);
    });

    it("fetchCurrentUser: 401 redirige a /acceso y limpia usuario", async () => {
      setStoredUser({ sub: "u1" });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Sesión vencida" }),
      });

      await expect(fetchCurrentUser()).rejects.toThrow(ApiError);
      expect(getStoredUser()).toBeNull();
      expect(global.window.location.replace).toHaveBeenCalledWith("/acceso");
    });

    it("fetchCurrentUser: error distinto a 401 limpia usuario pero no redirige", async () => {
      setStoredUser({ sub: "u1" });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Server error" }),
      });

      await expect(fetchCurrentUser()).rejects.toThrow(ApiError);
      expect(getStoredUser()).toBeNull();
      expect(global.window.location.replace).not.toHaveBeenCalled();
    });

    it("hasValidSession: devuelve true si la sesión es válida y false si falla", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { sub: "u1" } }),
      });
      expect(await hasValidSession()).toBe(true);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "No auth" }),
      });
      expect(await hasValidSession()).toBe(false);
    });
  });

  describe("triggerPanicButton y reportIncident", () => {
    it("triggerPanicButton: valida que lat y lng sean números finitos", async () => {
      await expect(
        triggerPanicButton({ latitude: "no-number", longitude: -58.38 })
      ).rejects.toThrow("latitude/longitude deben ser números");

      await expect(
        triggerPanicButton({ latitude: NaN, longitude: -58.38 })
      ).rejects.toThrow("latitude/longitude deben ser números");

      await expect(
        triggerPanicButton({ latitude: -34.6, longitude: Infinity })
      ).rejects.toThrow("latitude/longitude deben ser números");
    });

    it("triggerPanicButton: envía POST /api/backend/panic-button con campos correctos y recorta dirección", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, emergencyId: "e1" }),
      });

      const longAddress = "A".repeat(250);
      const res = await triggerPanicButton({
        latitude: -34.6037,
        longitude: "-58.3816",
        description: "Alerta de pánico",
        address: longAddress,
      });

      expect(res).toEqual({ success: true, emergencyId: "e1" });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/panic-button",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            location: { latitude: -34.6037, longitude: -58.3816 },
            severity: "critical",
            emergencyType: "panic",
            description: "Alerta de pánico",
            address: "A".repeat(200),
          }),
        })
      );
    });

    it("reportIncident: mapea tipo de categoría a severidad por defecto", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true, emergencyId: "e2" }),
      });

      await reportIncident({
        category: "medical",
        latitude: -34.6,
        longitude: -58.4,
      });
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).severity).toBe("high");

      global.fetch.mockClear();
      await reportIncident({
        category: "fire",
        latitude: -34.6,
        longitude: -58.4,
      });
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).severity).toBe("high");

      global.fetch.mockClear();
      await reportIncident({
        category: "traffic",
        latitude: -34.6,
        longitude: -58.4,
      });
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).severity).toBe("medium");

      global.fetch.mockClear();
      await reportIncident({
        category: "other",
        latitude: -34.6,
        longitude: -58.4,
        severity: "critical",
      });
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).severity).toBe("critical");
    });
  });

  describe("Operaciones de emergencias", () => {
    it("fetchEmergencyDetail: devuelve data del detalle", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", status: "PENDING" } }),
      });

      const detail = await fetchEmergencyDetail("e1");
      expect(detail).toEqual({ id: "e1", status: "PENDING" });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/emergencies/e1",
        expect.anything()
      );
    });

    it("fetchEmergencyHistory: devuelve statusHistory o array vacío", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", statusHistory: [{ status: "PENDING" }] } }),
      });
      expect(await fetchEmergencyHistory("e1")).toEqual([{ status: "PENDING" }]);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1" } }),
      });
      expect(await fetchEmergencyHistory("e1")).toEqual([]);
    });

    it("fetchEmergenciesPage: construye query string y procesa data/pagination", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "e1" }],
          pagination: { page: 2, limit: 10, total: 20, totalPages: 2 },
        }),
      });

      const result = await fetchEmergenciesPage({
        status: "PENDING,VALIDATED",
        page: 2,
        limit: 10,
        sortBy: "createdAt",
        order: "asc",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("status=PENDING%2CVALIDATED&page=2&limit=10&sortBy=createdAt&order=asc"),
        expect.anything()
      );
      expect(result.data).toEqual([{ id: "e1" }]);
      expect(result.pagination).toEqual({ page: 2, limit: 10, total: 20, totalPages: 2 });
    });

    it("fetchEmergencies: invoca fetchEmergenciesPage con limit 100", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "e100" }] }),
      });

      const list = await fetchEmergencies();
      expect(list).toEqual([{ id: "e100" }]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=100"),
        expect.anything()
      );
    });

    it("cancelEmergency: envía PATCH /api/emergencies/:id/cancel con reason", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", status: "CANCELLED" } }),
      });

      const res = await cancelEmergency("e1", "falsa alarma");
      expect(res).toEqual({ id: "e1", status: "CANCELLED" });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/emergencies/e1/cancel",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ reason: "falsa alarma" }),
        })
      );
    });

    it("validateEmergency & discardEmergency: envían peticiones PATCH correspondientes", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", status: "VALIDATED" } }),
      });
      const valid = await validateEmergency("e1");
      expect(valid.status).toBe("VALIDATED");

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", status: "DISCARDED" } }),
      });
      const discarded = await discardEmergency("e1", "duplicada");
      expect(discarded.status).toBe("DISCARDED");
    });
  });

  describe("Oficiales", () => {
    it("fetchOfficers: devuelve lista con o sin filtro de status", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "of1" }] }),
      });
      const officers = await fetchOfficers({ status: "AVAILABLE" });
      expect(officers).toEqual([{ id: "of1" }]);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/officers?status=AVAILABLE",
        expect.anything()
      );

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "of2" }],
      });
      const all = await fetchOfficers();
      expect(all).toEqual([{ id: "of2" }]);
    });

    it("assignOfficer: asigna oficial mediante PATCH y formatea respuesta", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: "e1", status: "DISPATCHED", assignedOfficer: "Oficial Perez" },
        }),
      });

      const res = await assignOfficer("e1", "of1");
      expect(res).toMatchObject({
        success: true,
        status: "DISPATCHED",
        assignedOfficer: "Oficial Perez",
        assignedOfficerId: "of1",
      });
    });
  });

  describe("Stubs 501", () => {
    it("lanzan ApiError con status 501 indicando funcionalidad no implementada", async () => {
      await expect(overridePriority()).rejects.toThrow(ApiError);
      await expect(overridePriority()).rejects.toMatchObject({ status: 501 });

      await expect(updateEmergencyStatus()).rejects.toThrow(ApiError);
      await expect(updateEmergencyStatus()).rejects.toMatchObject({ status: 501 });

      await expect(addObservation()).rejects.toThrow(ApiError);
      await expect(addObservation()).rejects.toMatchObject({ status: 501 });

      await expect(requestReinforcements()).rejects.toThrow(ApiError);
      await expect(requestReinforcements()).rejects.toMatchObject({ status: 501 });
    });
  });

  describe("Manejo de errores HTTP y redirectToLogin", () => {
    it("apiFetch: cuando res.ok es falso y status es 401, redirige al login", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Token inválido" }),
      });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow(ApiError);
      expect(global.window.location.replace).toHaveBeenCalledWith("/acceso");
    });

    it("apiFetch: si ya está en /acceso, no vuelve a llamar a replace", async () => {
      global.window.location.pathname = "/acceso/directo";
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "No auth" }),
      });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow(ApiError);
      expect(global.window.location.replace).not.toHaveBeenCalled();
    });

    it("apiFetch: maneja respuestas que no son JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow("Error HTTP 502");
    });
  });
});
