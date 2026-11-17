import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  POLLING_INTERVAL_MS,
  CITIZEN_POLLING_INTERVAL_MS,
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  ApiError,
  loginDev,
  loginWithPassword,
  loginWithLdap,
  registerAccount,
  logout,
  fetchCurrentUser,
  triggerPanicButton,
  fetchEmergencyDetail,
  fetchEmergencies,
  fetchEmergenciesPage,
  fetchOpsEmergencies,
  OPS_STATUSES,
  isOpsStatus,
  cancelEmergency,
  reportIncident,
  validateEmergency,
  closeEmergency,
  discardEmergency,
  overridePriority,
  fetchOfficers,
  fetchAlertasClimaticasActivas,
  assignOfficer,
  fetchOfficerEmergencies,
  advanceOfficerStatus,
  OFFICER_NEXT_STEP,
  addObservation,
  requestReinforcements,
  fetchEmergencyHistory,
  LocationError,
  getCurrentLocation,
  getStoredUser,
  setStoredUser,
} from "../app/lib/api.js";

// window, sessionStorage y navigator se stubbean con vi.stubGlobal y se
// restauran con vi.unstubAllGlobals(): desde Node 21 `navigator` es un getter
// sin setter y asignarlo directo tira TypeError (ver getCurrentLocation más
// abajo). fetch se sigue pisando a mano porque en Node es una propiedad
// escribible y se restaura en el afterEach.
describe("api.js", () => {
  let originalFetch;
  let mockSessionStorage;

  beforeEach(() => {
    originalFetch = global.fetch;

    const store = new Map();
    mockSessionStorage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, val) => store.set(key, String(val))),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    };

    vi.stubGlobal("window", {
      location: {
        pathname: "/dashboard",
        replace: vi.fn(),
      },
      sessionStorage: mockSessionStorage,
    });
    vi.stubGlobal("sessionStorage", mockSessionStorage);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Constantes exportadas", () => {
    it("define intervalos de polling esperados", () => {
      expect(POLLING_INTERVAL_MS).toBe(30000);
      expect(CITIZEN_POLLING_INTERVAL_MS).toBe(30000);
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
      // setStoredUser solo persiste claims de sesión (sin PII); completa defaults.
      expect(getStoredUser()).toEqual({
        sub: "u1",
        username: "juan",
        groups: [],
        hasAntipanicButton: false,
        loginMethod: "directo",
      });
    });

    it("loginDev: lanza ApiError si el login falla", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Credenciales inválidas" }),
      });

      await expect(loginDev({ sub: "bad" })).rejects.toThrow(ApiError);
    });

    it("loginWithPassword: POST email+password y guarda sesión", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          user: { sub: "u2", username: "ana", groups: ["citizen"] },
        }),
      });

      const result = await loginWithPassword({
        email: "ana@city.com",
        password: "secret",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "ana@city.com", password: "secret" }),
        })
      );
      expect(result.user).toMatchObject({
        sub: "u2",
        username: "ana",
        loginMethod: "sesion",
      });
      expect(getStoredUser()).toMatchObject({
        sub: "u2",
        username: "ana",
        loginMethod: "sesion",
      });
    });

    it("loginWithPassword: lanza ApiError si falla", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      await expect(
        loginWithPassword({ email: "x@y.com", password: "bad" })
      ).rejects.toThrow(ApiError);
    });

    it("loginWithLdap: envía POST /api/auth/login con loginType ldap, guarda usuario y método", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          user: { sub: "ldap_1", username: "operador1", groups: ["dispatcher"] },
        }),
      });

      const result = await loginWithLdap({
        username: "  operador1  ",
        password: "secretpassword",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            username: "operador1",
            email: "operador1",
            password: "secretpassword",
            loginType: "ldap",
          }),
        })
      );
      expect(result.user).toMatchObject({
        sub: "ldap_1",
        username: "operador1",
        loginMethod: "ldap",
      });
      expect(getStoredUser()).toMatchObject({
        sub: "ldap_1",
        username: "operador1",
        loginMethod: "ldap",
      });
    });

    it("loginWithLdap: lanza ApiError si el login LDAP falla", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Usuario o contraseña inválidos en LDAP" }),
      });

      await expect(
        loginWithLdap({ username: "bad", password: "bad" })
      ).rejects.toThrow(ApiError);
    });

    it("registerAccount: POST register y guarda sesión", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          user: { sub: "u3", username: "nuevo", groups: ["citizen"] },
        }),
      });

      const result = await registerAccount({
        email: "nuevo@city.com",
        password: "secret",
        preferred_username: "nuevo",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "nuevo@city.com",
            password: "secret",
            preferred_username: "nuevo",
          }),
        })
      );
      expect(result.user.loginMethod).toBe("sesion");
      expect(getStoredUser()?.sub).toBe("u3");
    });

    it("registerAccount: lanza ApiError si falla", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: "Email ya registrado" }),
      });

      await expect(
        registerAccount({ email: "dup@city.com", password: "x" })
      ).rejects.toMatchObject({ message: "Email ya registrado", status: 409 });
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
      setStoredUser({ sub: "u1", loginMethod: "sesion" });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            sub: "u1",
            username: "juan",
            groups: ["citizen"],
            hasAntipanicButton: true,
            email: "test@city.com",
          },
        }),
      });

      const user = await fetchCurrentUser();

      // El return incluye lo que vino de session (puede traer email en memoria),
      // pero sessionStorage no guarda PII como email.
      expect(user).toMatchObject({
        sub: "u1",
        username: "juan",
        groups: ["citizen"],
        hasAntipanicButton: true,
        loginMethod: "sesion",
        email: "test@city.com",
      });
      expect(getStoredUser()).toEqual({
        sub: "u1",
        username: "juan",
        groups: ["citizen"],
        hasAntipanicButton: true,
        loginMethod: "sesion",
      });
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

    it("triggerPanicButton: envía POST /api/backend/api/panic-button con campos correctos y recorta dirección", async () => {
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
        "/api/backend/api/panic-button",
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

    it("reportIncident: reemplaza el mensaje de pánico del backend", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          emergencyId: "e3",
          message: "Botón de pánico activado",
        }),
      });

      const result = await reportIncident({
        category: "other",
        latitude: -34.6,
        longitude: -58.4,
      });

      expect(result.message).toBe(
        "Tu reporte fue registrado y ya está en camino al centro de operaciones."
      );
      expect(result.message).not.toMatch(/pánico/i);
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
        "/api/backend/api/emergencies/e1",
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

    describe("listado operativo del dispatcher", () => {
      function mockList(data = []) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data }),
        });
      }

      function requestedParams() {
        const [url] = global.fetch.mock.calls[0];
        const [path, query] = url.split("?");
        return { path, params: new URLSearchParams(query) };
      }

      it("OPS_STATUSES son los estados abiertos, sin cerradas, canceladas, descartadas ni CREATED", () => {
        expect(OPS_STATUSES).toEqual([
          "PENDING",
          "VALIDATED",
          "DISPATCHED",
          "EN_ROUTE",
          "ON_SCENE",
          "RESOLVED",
        ]);
        expect(isOpsStatus("ON_SCENE")).toBe(true);
        ["CLOSED", "CANCELLED", "DISCARDED", "CREATED", undefined].forEach((status) => {
          expect(isOpsStatus(status)).toBe(false);
        });
      });

      it("fetchOpsEmergencies: filtra por estado y ordena por prioridad, críticas primero", async () => {
        mockList([{ id: "crit-vieja" }]);

        const list = await fetchOpsEmergencies();

        expect(list).toEqual([{ id: "crit-vieja" }]);
        const { path, params } = requestedParams();
        expect(path).toBe("/api/backend/api/emergencies");
        // El backend hace status.split(",") → status = ANY(...).
        expect(params.get("status")).toBe(
          "PENDING,VALIDATED,DISPATCHED,EN_ROUTE,ON_SCENE,RESOLVED"
        );
        // sortBy=priority + desc = prioridad efectiva más alta primero.
        expect(params.get("sortBy")).toBe("priority");
        expect(params.get("order")).toBe("desc");
        expect(params.get("limit")).toBe("100");
        expect(params.get("page")).toBe("1");
      });

      it("fetchEmergencies (Mis alertas del ciudadano) no cambia: sin filtro de estado y por fecha", async () => {
        mockList();

        await fetchEmergencies();

        const { params } = requestedParams();
        expect(params.has("status")).toBe(false);
        expect(params.get("sortBy")).toBe("createdAt");
        expect(params.get("order")).toBe("desc");
      });
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
        "/api/backend/api/emergencies/e1/cancel",
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

    it("closeEmergency: envía PATCH /api/emergencies/:id/close sin body", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "e1", status: "CLOSED" } }),
      });

      const closed = await closeEmergency("e1");

      expect(closed).toEqual({ id: "e1", status: "CLOSED" });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/api/emergencies/e1/close",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({}),
        })
      );
    });
  });

  describe("Oficiales", () => {
    // El backend solo conoce `disponible` y `ocupado` (CHECK officers_status_check
    // de la migración V11) y filtra por igualdad exacta: cualquier otro valor
    // (p. ej. "AVAILABLE") devuelve una lista vacía. AssignOfficerModal pide
    // `disponible`.
    it("fetchAlertasClimaticasActivas: pide el endpoint sin filtro y normaliza una entrada por alerta", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { alertaId: "a-1", nivel: "CRITICA", fenomenoEtiqueta: "Granizo", barrios: ["PALERMO"], enCurso: true, puntos: 1, radioMetros: 1000 },
            { alertaId: "a-2", nivel: "MEDIA" },
          ],
        }),
      });
      const alertas = await fetchAlertasClimaticasActivas();
      expect(global.fetch).toHaveBeenCalledWith("/api/backend/api/contextos-zona/activos", expect.anything());
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ id: "a-1", nivelLabel: "crítica", fenomenoLabel: "Granizo", barrios: ["Palermo"] });
    });

    it("fetchOfficers: devuelve lista con o sin filtro de status", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "of-001", status: "disponible" }] }),
      });
      const officers = await fetchOfficers({ status: "disponible" });
      expect(officers).toEqual([{ id: "of-001", status: "disponible" }]);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/api/officers?status=disponible",
        expect.anything()
      );

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "of2" }],
      });
      const all = await fetchOfficers();
      expect(all).toEqual([{ id: "of2" }]);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      const empty = await fetchOfficers();
      expect(empty).toEqual([]);
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

  // Estos 501 los tira el FRONT sin llamar al backend (no hay fetch). Los
  // tests fijan ese comportamiento local, no el estado del backend.
  describe("Stubs 501 del front (no llaman al backend)", () => {
    it("prioridad manual, observaciones y refuerzos: el backend tampoco tiene endpoint", async () => {
      await expect(overridePriority()).rejects.toThrow(ApiError);
      await expect(overridePriority()).rejects.toMatchObject({ status: 501 });

      await expect(addObservation()).rejects.toThrow(ApiError);
      await expect(addObservation()).rejects.toMatchObject({ status: 501 });

      await expect(requestReinforcements()).rejects.toThrow(ApiError);
      await expect(requestReinforcements()).rejects.toMatchObject({ status: 501 });
    });

  });

  describe("Oficial (HU-08)", () => {
    it("fetchOfficerEmergencies pide solo estados de oficial, sin assignedOfficerId", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "e1" }], pagination: null }),
      });

      const data = await fetchOfficerEmergencies();

      expect(data).toEqual([{ id: "e1" }]);
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain("/api/backend/api/emergencies?");
      expect(decodeURIComponent(url)).toContain("status=DISPATCHED,EN_ROUTE,ON_SCENE");
      expect(url).not.toContain("assignedOfficerId");
    });

    it.each(["en-route", "on-scene", "resolve"])("advanceOfficerStatus(%s) hace PATCH a esa ruta", async (action) => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "e1" } }),
      });

      await expect(advanceOfficerStatus("e1", action)).resolves.toEqual({ id: "e1" });
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/backend/api/emergencies/e1/${action}`,
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("advanceOfficerStatus manda las causas relacionadas al resolver", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: "e1" } }),
      });

      await advanceOfficerStatus("e1", "resolve", {
        causasRelacionadas: ["RESIDUOS"],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/backend/api/emergencies/e1/resolve",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ causasRelacionadas: ["RESIDUOS"] }),
        })
      );
    });

    it("advanceOfficerStatus rechaza una acción desconocida sin llamar al backend", async () => {
      global.fetch = vi.fn();
      await expect(advanceOfficerStatus("e1", "close")).rejects.toThrow(ApiError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("OFFICER_NEXT_STEP sigue la máquina de estados del backend", () => {
      expect(OFFICER_NEXT_STEP.DISPATCHED.action).toBe("en-route");
      expect(OFFICER_NEXT_STEP.EN_ROUTE.action).toBe("on-scene");
      expect(OFFICER_NEXT_STEP.ON_SCENE.action).toBe("resolve");
      expect(OFFICER_NEXT_STEP.RESOLVED).toBeUndefined();
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

    it("apiFetch: intenta refresh token ante 401 y reintenta la petición exitosamente", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: "Token vencido" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: "e1", status: "PENDING" } }),
        });

      const detail = await fetchEmergencyDetail("e1");
      expect(detail).toEqual({ id: "e1", status: "PENDING" });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/auth/refresh",
        expect.objectContaining({ method: "POST", credentials: "same-origin" })
      );
      expect(global.window.location.replace).not.toHaveBeenCalled();
    });

    it("apiFetch: si el refresh tiene éxito pero el retry falla, redirige a login", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: "Token vencido" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ message: "Acceso denegado" }),
        });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow(ApiError);
      expect(global.window.location.replace).toHaveBeenCalledWith("/acceso");
    });

    it("apiFetch: si el refresh lanza una excepción de red, continúa con redirectToLogin", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: "Token vencido" }),
        })
        .mockRejectedValueOnce(new Error("Network failure"));

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

    it("apiFetch: utiliza data.error cuando data.message no está presente", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Error específico de validación" }),
      });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow("Error específico de validación");
    });

    it("apiFetch: maneja redirectToLogin en ambiente SSR (window === undefined)", async () => {
      vi.stubGlobal("window", undefined);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      await expect(fetchEmergencyDetail("e1")).rejects.toThrow("Unauthorized");
    });
  });

  // navigator se restaura en el afterEach de arriba (vi.unstubAllGlobals).
  describe("getCurrentLocation & LocationError", () => {
    it("rechaza con NOT_SUPPORTED si navigator.geolocation no existe", async () => {
      vi.stubGlobal("navigator", {});
      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "NOT_SUPPORTED",
        message: expect.stringContaining("no soporta geolocalización"),
      });
    });

    it("case 1: rechaza con PERMISSION_DENIED y mensaje correspondiente cuando code es 1", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 1, message: "User denied Geolocation" });
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "PERMISSION_DENIED",
        message: "Permiso de ubicación denegado. Habilitá la geolocalización en tu navegador para continuar.",
      });
    });

    it("case 2: rechaza con POSITION_UNAVAILABLE y mensaje correspondiente cuando code es 2", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 2, message: "Position unavailable" });
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "POSITION_UNAVAILABLE",
        message: "Ubicación no disponible en este momento. Verificá la señal de GPS o conexión de red.",
      });
    });

    it("case 3: rechaza con TIMEOUT y mensaje correspondiente cuando code es 3", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 3, message: "Timeout" });
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "TIMEOUT",
        message: "Tiempo de espera agotado al intentar determinar la ubicación.",
      });
    });

    it("default / desconocido: rechaza con POSITION_UNAVAILABLE y err.message cuando code es no estándar", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 99, message: "Fallo desconocido de sensor" });
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "POSITION_UNAVAILABLE",
        message: "Fallo desconocido de sensor",
      });
    });

    it("callback con err null: rechaza con mensaje y código por defecto", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error(null);
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "POSITION_UNAVAILABLE",
        message: "No se pudo obtener tu ubicación actual.",
      });
    });

    it("éxito: resuelve con coordenadas precisas y accuracy", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((success) => {
            success({
              coords: { latitude: -34.6037, longitude: -58.3816, accuracy: 10 },
            });
          }),
        },
      });

      const loc = await getCurrentLocation();
      expect(loc).toEqual({
        latitude: -34.6037,
        longitude: -58.3816,
        precise: true,
        accuracy: 10,
      });
    });

    it("window.__lastCoords: resuelve inmediatamente si ya existen coordenadas cacheadas", async () => {
      vi.stubGlobal("window", {
        __lastCoords: { latitude: -34.5, longitude: -58.4, precise: true, accuracy: 5 },
      });

      const loc = await getCurrentLocation();
      expect(loc).toEqual({
        latitude: -34.5,
        longitude: -58.4,
        precise: true,
        accuracy: 5,
      });
    });
  });
});
