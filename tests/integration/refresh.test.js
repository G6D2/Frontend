// Integración: POST /api/auth/refresh (app/api/auth/refresh/route.js)
//
// Solo las sesiones del Login Federado tienen la cookie citypass_refresh. El
// route tiene que avisar con `reason` y `sessionActive` qué pasó, porque el
// browser no lee cookies httpOnly y SessionRefreshManager decide con eso si
// manda a /acceso (app/lib/sessionRefresh.js). El CSRF de esta ruta está en
// csrf.test.js.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST as refresh } from "../../app/api/auth/refresh/route.js";
import { POST as login } from "../../app/api/auth/login/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

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
