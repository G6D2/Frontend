// Integración: POST /api/auth/refresh (app/api/auth/refresh/route.js)
//
// Solo las sesiones del Login Federado tienen la cookie citypass_refresh. El
// route tiene que avisar con `reason` y `sessionActive` qué pasó, porque el
// browser no lee cookies httpOnly y SessionRefreshManager decide con eso si
// manda a /acceso (app/lib/sessionRefresh.js). El CSRF de esta ruta está en
// csrf.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST as refresh } from "../../app/api/auth/refresh/route.js";
import { POST as login } from "../../app/api/auth/login/route.js";
import {
  mockNextCookies,
  mockBackend,
  mockHangingFetch,
  fakeAbortSignalTimeout,
  makeRequest,
} from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const inSeconds = (s) => Math.floor(Date.now() / 1000) + s;
const VALID = jwtFor({ sub: "juan-trabaja", groups: ["dispatchers"], exp: inSeconds(600) });
const EXPIRED = jwtFor({ sub: "juan-trabaja", groups: ["dispatchers"], exp: inSeconds(-60) });
const REFRESHED = jwtFor({ sub: "juan-trabaja", groups: ["dispatchers"], exp: inSeconds(900) });

const SAME_ORIGIN = { Host: "citypass.test", Origin: "https://citypass.test" };

function refreshRequest() {
  return makeRequest("https://citypass.test/api/auth/refresh", {
    method: "POST",
    headers: SAME_ORIGIN,
  });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sesión local (sin citypass_refresh)", () => {
    it("token vigente: 401 no_refresh_token con sessionActive=true, sin llamar al IdP ni tocar cookies", async () => {
      mockNextCookies(cookies, { citypass_session: VALID });
      const { calls } = mockBackend({});

      const res = await refresh(refreshRequest());
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json).toMatchObject({ reason: "no_refresh_token", sessionActive: true });
      expect(calls).toHaveLength(0);
      expect(res.cookies.get("citypass_session")).toBeUndefined();
      expect(res.cookies.get("citypass_refresh")).toBeUndefined();
    });

    it("token vencido: sessionActive=false", async () => {
      mockNextCookies(cookies, { citypass_session: EXPIRED });
      const { calls } = mockBackend({});

      const json = await (await refresh(refreshRequest())).json();

      expect(json).toMatchObject({ reason: "no_refresh_token", sessionActive: false });
      expect(calls).toHaveLength(0);
    });
  });

  describe("sesión federada", () => {
    it("refresh OK: manda el refresh token al IdP y rota las dos cookies", async () => {
      mockNextCookies(cookies, { citypass_session: VALID, citypass_refresh: "rt-1" });
      const { calls } = mockBackend({
        "POST /auth/refresh": {
          status: 200,
          body: { access_token: REFRESHED, refresh_token: "rt-2", expires_in: 900 },
        },
      });

      const res = await refresh(refreshRequest());

      expect(res.status).toBe(200);
      expect(JSON.parse(calls[0].body)).toEqual({ refreshToken: "rt-1" });
      expect(res.cookies.get("citypass_session")?.value).toBe(REFRESHED);
      expect(res.cookies.get("citypass_refresh")?.value).toBe("rt-2");
    });

    it("el IdP rechaza el refresh token con el access token vigente: borra solo citypass_refresh", async () => {
      mockNextCookies(cookies, { citypass_session: VALID, citypass_refresh: "rt-revocado" });
      mockBackend({ "POST /auth/refresh": { status: 401, body: { message: "Refresh token revocado" } } });

      const res = await refresh(refreshRequest());
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json).toMatchObject({ reason: "refresh_rejected", sessionActive: true });
      expect(res.cookies.get("citypass_refresh")?.maxAge).toBe(0);
      expect(res.cookies.get("citypass_session")).toBeUndefined();
    });

    it("el IdP rechaza el refresh token con el access token vencido: borra las dos", async () => {
      mockNextCookies(cookies, { citypass_session: EXPIRED, citypass_refresh: "rt-vencido" });
      mockBackend({ "POST /auth/refresh": { status: 400, body: {} } });

      const res = await refresh(refreshRequest());
      const json = await res.json();

      expect(json).toMatchObject({ reason: "refresh_rejected", sessionActive: false });
      expect(res.cookies.get("citypass_refresh")?.maxAge).toBe(0);
      expect(res.cookies.get("citypass_session")?.maxAge).toBe(0);
    });

    it("429 del LDAP: lo identifica (reason, source, Retry-After) y no toca cookies", async () => {
      mockNextCookies(cookies, { citypass_session: EXPIRED, citypass_refresh: "rt-1" });
      mockBackend({
        "POST /auth/refresh": {
          status: 429,
          body: { message: "Too many requests" },
          headers: { "content-type": "application/json", "retry-after": "300" },
        },
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await refresh(refreshRequest());
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(res.headers.get("X-Rate-Limited-By")).toBe("ldap");
      expect(res.headers.get("Retry-After")).toBe("300");
      expect(json).toMatchObject({
        reason: "idp_rate_limited",
        source: "ldap",
        retryAfterSeconds: 300,
        sessionActive: false,
      });
      expect(json.message).toBe(
        "El Login Federado (LDAP) está limitando los ingresos de esta app. Probá de nuevo en 5 minutos."
      );
      expect(res.cookies.get("citypass_session")).toBeUndefined();
      expect(res.cookies.get("citypass_refresh")).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[429\]\[ldap\] POST \/auth\/refresh .*retry-after=300/));
      expect(res.headers.get("X-429-Logged")).toBe("1");
      warn.mockRestore();
    });

    it.each([
      ["sin conexión", "network-error"],
      ["5xx", { status: 503, body: {} }],
      ["200 sin access_token", { status: 200, body: {} }],
    ])("IdP con error (%s): 502 idp_error y no toca cookies", async (_label, idpResponse) => {
      mockNextCookies(cookies, { citypass_session: VALID, citypass_refresh: "rt-1" });
      mockBackend({ "POST /auth/refresh": idpResponse });

      const res = await refresh(refreshRequest());
      const json = await res.json();

      expect(res.status).toBe(502);
      expect(json).toMatchObject({ reason: "idp_error", sessionActive: true });
      expect(res.cookies.get("citypass_session")).toBeUndefined();
      expect(res.cookies.get("citypass_refresh")).toBeUndefined();
    });
  });

  // Si el IdP no responde, el refresh no puede quedar colgado (lo espera el
  // browser: SessionRefreshManager y el reintento ante 401 de app/lib/api.js).
  // La ruta corta a los 8 s y devuelve 504, con el mismo `reason` y
  // `sessionActive` que los demás errores del IdP.
  describe("sesión federada: el IdP no responde", () => {
    const originalFetch = global.fetch;
    let timeoutSpy;

    beforeEach(() => {
      vi.useFakeTimers();
      timeoutSpy = fakeAbortSignalTimeout();
    });

    afterEach(() => {
      timeoutSpy.mockRestore();
      vi.useRealTimers();
      global.fetch = originalFetch;
    });

    it.each([
      ["token vigente", VALID, true],
      ["token vencido", EXPIRED, false],
    ])("sin respuesta con el %s: espera 8 s, devuelve 504 idp_error y no toca cookies", async (_label, token, sessionActive) => {
      mockNextCookies(cookies, { citypass_session: token, citypass_refresh: "rt-1" });
      const { calls } = mockHangingFetch();

      let settled = false;
      const pending = refresh(refreshRequest()).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(7999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const res = await pending;

      expect(res.status).toBe(504);
      expect(await res.json()).toEqual({
        error: "Gateway Timeout",
        reason: "idp_error",
        sessionActive,
        message: "El Login Federado no responde. Probá de nuevo.",
      });
      expect(res.cookies.get("citypass_session")).toBeUndefined();
      expect(res.cookies.get("citypass_refresh")).toBeUndefined();
      expect(timeoutSpy).toHaveBeenCalledWith(8000);
      expect(calls).toHaveLength(1);
      expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    });

    it("responde los headers y se cuelga el cuerpo: también 504 y no toca cookies", async () => {
      mockNextCookies(cookies, { citypass_session: VALID, citypass_refresh: "rt-1" });
      mockHangingFetch({ afterHeaders: true });

      const pending = refresh(refreshRequest());
      await vi.advanceTimersByTimeAsync(8000);
      const res = await pending;

      expect(res.status).toBe(504);
      expect(await res.json()).toMatchObject({ reason: "idp_error", sessionActive: true });
      expect(res.cookies.get("citypass_session")).toBeUndefined();
      expect(res.cookies.get("citypass_refresh")).toBeUndefined();
    });
  });
});

describe("POST /api/auth/login y la cookie citypass_refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
  });

  it("login local (atajo demo) borra un citypass_refresh que haya quedado de un Login Federado", async () => {
    const token = jwtFor({ sub: "DISP-Demo001", groups: ["dispatcher"], exp: inSeconds(900) });
    mockBackend({
      "POST /auth/dev/login": { status: 200, body: { access_token: token, expires_in: 900 } },
      "GET /api/user": { status: 404, body: {} },
    });

    const res = await login(
      makeRequest("https://citypass.test/api/auth/login", {
        method: "POST",
        headers: { ...SAME_ORIGIN, Cookie: "citypass_refresh=rt-federado-viejo" },
        body: { sub: "DISP-Demo001", preferred_username: "Dispatcher Demo", groups: ["dispatcher"] },
      })
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_session")?.value).toBe(token);
    expect(res.cookies.get("citypass_refresh")?.maxAge).toBe(0);
  });

  it("login federado guarda el refresh token del IdP", async () => {
    const token = jwtFor({ sub: "juan-trabaja", groups: ["dispatchers"], exp: inSeconds(900) });
    mockBackend({
      "POST /auth/login": {
        status: 200,
        body: { access_token: token, refresh_token: "rt-idp", expires_in: 900 },
      },
      "GET /api/user": { status: 401, body: {} },
    });

    // Usuario y contraseña inventados: el IdP está mockeado.
    const res = await login(
      makeRequest("https://citypass.test/api/auth/login", {
        method: "POST",
        headers: SAME_ORIGIN,
        body: { username: "usuario-de-prueba", password: "x", loginType: "ldap" },
      })
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_refresh")?.value).toBe("rt-idp");
    expect(res.cookies.get("citypass_refresh")?.maxAge).toBe(28800);
  });
});
