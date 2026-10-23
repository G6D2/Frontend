// Integración: POST /api/auth/login (app/api/auth/login/route.js)
//
// Cubre: login OK setea la cookie de sesión y arma `user` (incluyendo
// `hasAntipanicButton` desde GET /api/user cuando ANTIPANIC_MODE="backend"),
// un 400 del backend se propaga tal cual, y los 502 transitorios del backend
// dormido (Render free) se resuelven solos gracias a lib/backend-fetch.js.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST } from "../../app/api/auth/login/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

const LOGIN_URL = "http://localhost/api/auth/login";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({
  sub: "U1",
  preferred_username: "vecina1",
  groups: ["citizen"],
  exp: Math.floor(Date.now() / 1000) + 900,
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
  });

  it("login OK: setea cookie y toma hasAntipanicButton de GET /api/user (modo backend)", async () => {
    mockBackend({
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      "GET /api/user": {
        status: 200,
        body: { data: { hasAntipanicButton: true } },
      },
    });

    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { username: "vecina1", loginMethod: "dev" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({
      sub: "U1",
      username: "vecina1",
      hasAntipanicButton: true,
    });

    const setCookie = res.cookies.get("citypass_session");
    expect(setCookie?.value).toBe(TOKEN);
  });

  it("respeta hasAntipanicButton=false desde el perfil backend", async () => {
    mockBackend({
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      "GET /api/user": {
        status: 200,
        body: { data: { hasAntipanicButton: false } },
      },
    });

    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { username: "vecina1", loginMethod: "dev" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.user.hasAntipanicButton).toBe(false);
  });

  it("ignora hasAntipanicButton del body en modo backend", async () => {
    mockBackend({
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      "GET /api/user": { status: 404, body: {} },
    });

    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { username: "vecina1", hasAntipanicButton: true },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.user.hasAntipanicButton).toBeUndefined();
  });

  it("login con email demo (404 en /auth/login): inyecta hasAntipanicButton desde DEMO_ACCOUNTS", async () => {
    // Simula backend local: /auth/login → 404, /auth/dev/login → OK
    mockBackend({
      "POST /auth/login": { status: 404, body: { error: "Not Found" } },
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      // /api/user no conoce el claim → no devuelve hasAntipanicButton
      "GET /api/user": { status: 200, body: { data: { sub: "juanpanico" } } },
    });

    // juanpanico@gmail.com → hasAntipanicButton: true en DEMO_ACCOUNTS
    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { email: "juanpanico@gmail.com", password: "abracadabra" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.hasAntipanicButton).toBe(true);
  });

  it("login con email demo sin boton antipanico: inyecta false desde DEMO_ACCOUNTS", async () => {
    mockBackend({
      "POST /auth/login": { status: 404, body: { error: "Not Found" } },
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      "GET /api/user": { status: 200, body: { data: { sub: "luciatranquila" } } },
    });

    // luciatranquila@gmail.com → hasAntipanicButton: false en DEMO_ACCOUNTS
    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { email: "luciatranquila@gmail.com", password: "abracadabra" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.hasAntipanicButton).toBe(false);
  });

  it("backend 400: propaga el error sin setear cookie", async () => {
    mockBackend({
      "POST /auth/dev/login": {
        status: 400,
        body: { error: "Bad Request", message: "usuario inválido" },
      },
    });

    const req = makeRequest(LOGIN_URL, { method: "POST", body: { username: "" } });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toBe("usuario inválido");
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("backend responde 502 dos veces y luego 200: el login funciona gracias a los reintentos", async () => {
    mockBackend({
      "POST /auth/dev/login": [
        { status: 502, body: {} },
        { status: 502, body: {} },
        { status: 200, body: { access_token: TOKEN, expires_in: 900 } },
      ],
      "GET /api/user": { status: 404, body: {} },
    });

    const req = makeRequest(LOGIN_URL, {
      method: "POST",
      body: { username: "vecina1" },
    });

    // El reintento real espera 4s entre intentos (lib/backend-fetch.js);
    // en el test avanzamos los timers falsos para no esperar de verdad.
    vi.useFakeTimers();
    const pending = POST(req);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(4000);
    const res = await pending;
    vi.useRealTimers();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.sub).toBe("U1");
  });

  it("login con loginType ldap: devuelve user con grupo dispatcher", async () => {
    const DISPATCHER_TOKEN = jwtFor({
      sub: "dispatcher1",
      preferred_username: "dispatcher1",
      groups: ["dispatcher"],
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes("api.citypass-login.pp.ua") || url.includes("/auth/login")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: DISPATCHER_TOKEN,
            expires_in: 900,
          }),
        };
      }
      return originalFetch(url);
    });

    try {
      const req = makeRequest(LOGIN_URL, {
        method: "POST",
        body: { username: "dispatcher1", password: "secretpassword", loginType: "ldap" },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.user.sub).toBe("dispatcher1");
      expect(json.user.groups).toContain("dispatcher");
      expect(res.cookies.get("citypass_session")?.value).toBe(DISPATCHER_TOKEN);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
