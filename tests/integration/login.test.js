// Integración: POST /api/auth/login (app/api/auth/login/route.js)
//
// El route tiene dos caminos, según el body que manda la app:
//  - email + password (loginWithPassword) → POST /auth/login del backend.
//  - sub + groups (loginDev: "Cuenta ciudadana" y "Vista Dispatcher") →
//    POST /auth/dev/login. El backend exige `sub` (dev-login-policy.js:
//    sin sub responde 400 "sub is required").
//
// Cubre: login OK setea la cookie de sesión y arma `user` (incluyendo
// `hasAntipanicButton` desde GET /api/user cuando ANTIPANIC_MODE="backend"),
// lo que el BFF le reenvía al backend, un 400/401 del backend se propaga tal
// cual, y los 502 transitorios del backend dormido (Render free) se resuelven
// solos gracias a lib/backend-fetch.js.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST } from "../../app/api/auth/login/route.js";
import { DEMO_LOGIN_SHORTCUTS } from "../../app/lib/features.js";
import { getHomePathForUser } from "../../app/lib/auth-roles.js";
import {
  mockNextCookies,
  mockBackend,
  mockHangingFetch,
  fakeAbortSignalTimeout,
  makeRequest,
} from "./helpers.js";

const LOGIN_URL = "http://localhost/api/auth/login";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({
  sub: "U000042",
  preferred_username: "ciudadano",
  groups: ["citizen"],
  exp: Math.floor(Date.now() / 1000) + 900,
});

// Body que arma loginDev (app/lib/api.js) para el botón "Cuenta ciudadana".
// loginMethod no viaja: queda solo en sessionStorage.
const DEV_LOGIN_BODY = {
  sub: "U000042",
  preferred_username: "ciudadano",
  groups: ["citizen"],
  hasAntipanicButton: false,
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
  });

  it("email + password: va a /auth/login, reenvía solo las credenciales y setea la cookie", async () => {
    const userToken = jwtFor({
      sub: "6b1f7a52-0000-4000-8000-000000000001",
      preferred_username: "JuanPanico",
      groups: ["citizen"],
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    const { calls } = mockBackend({
      "POST /auth/login": {
        status: 200,
        body: {
          access_token: userToken,
          expires_in: 900,
          user: {
            sub: "6b1f7a52-0000-4000-8000-000000000001",
            username: "JuanPanico",
            groups: ["citizen"],
            hasAntipanicButton: true,
          },
        },
      },
      "GET /api/user": {
        status: 200,
        body: { data: { hasAntipanicButton: true } },
      },
    });

    const res = await POST(
      makeRequest(LOGIN_URL, {
        method: "POST",
        body: { email: "juanpanico@gmail.com", password: "abracadabra" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({ username: "JuanPanico", hasAntipanicButton: true });
    expect(res.cookies.get("citypass_session")?.value).toBe(userToken);

    const login = calls.find((c) => c.path === "/auth/login");
    expect(JSON.parse(login.body)).toEqual({
      email: "juanpanico@gmail.com",
      password: "abracadabra",
    });
    expect(calls.some((c) => c.path === "/auth/dev/login")).toBe(false);
  });

  it("email + password inválidos: propaga el 401 del backend sin setear cookie", async () => {
    mockBackend({
      "POST /auth/login": {
        status: 401,
        body: { error: "UnauthorizedError", message: "Correo o contraseña incorrectos." },
      },
    });

    const res = await POST(
      makeRequest(LOGIN_URL, {
        method: "POST",
        body: { email: "juanpanico@gmail.com", password: "mal" },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.message).toBe("Correo o contraseña incorrectos.");
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("atajo demo: va a /auth/dev/login con sub, setea cookie y toma hasAntipanicButton de GET /api/user", async () => {
    const { calls } = mockBackend({
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
      "GET /api/user": {
        status: 200,
        body: { data: { hasAntipanicButton: true } },
      },
    });

    const res = await POST(makeRequest(LOGIN_URL, { method: "POST", body: DEV_LOGIN_BODY }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({
      sub: "U000042",
      username: "ciudadano",
      hasAntipanicButton: true,
    });
    expect(res.cookies.get("citypass_session")?.value).toBe(TOKEN);

    // El BFF reenvía sub/preferred_username/groups; nada más.
    const devLogin = calls.find((c) => c.path === "/auth/dev/login");
    expect(JSON.parse(devLogin.body)).toEqual({
      sub: "U000042",
      preferred_username: "ciudadano",
      groups: ["citizen"],
    });
  });

  it("atajo dispatcher: reenvía el sub y el grupo de DISPATCHER_DEMO", async () => {
    const dispatcherToken = jwtFor({
      sub: "DISP-Demo001",
      preferred_username: "Dispatcher Demo",
      groups: ["dispatcher"],
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    const { calls } = mockBackend({
      "POST /auth/dev/login": {
        status: 200,
        body: { access_token: dispatcherToken, expires_in: 900 },
      },
      "GET /api/user": { status: 404, body: {} },
    });

    const res = await POST(
      makeRequest(LOGIN_URL, {
        method: "POST",
        body: {
          sub: "DISP-Demo001",
          preferred_username: "Dispatcher Demo",
          groups: ["dispatcher"],
          hasAntipanicButton: false,
        },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({ sub: "DISP-Demo001", groups: ["dispatcher"] });
    const devLogin = calls.find((c) => c.path === "/auth/dev/login");
    expect(JSON.parse(devLogin.body)).toMatchObject({
      sub: "DISP-Demo001",
      groups: ["dispatcher"],
    });
  });

  // Atajos "Demo" de /acceso: el body es el que arma loginDev con cada cuenta.
  it.each([
    ["CIT-JuanPanico", ["citizen"], "/inicio"],
  ])("atajo demo %s: reenvía sub y grupos a /auth/dev/login y el user lleva a %s", async (sub, groups, home) => {
    const { account } = DEMO_LOGIN_SHORTCUTS.find((s) => s.account.sub === sub);
    const token = jwtFor({
      sub,
      preferred_username: account.preferred_username,
      groups,
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    const { calls } = mockBackend({
      "POST /auth/dev/login": { status: 200, body: { access_token: token, expires_in: 900 } },
      "GET /api/user": {
        status: 200,
        body: { data: { hasAntipanicButton: account.hasAntipanicButton } },
      },
    });

    const res = await POST(
      makeRequest(LOGIN_URL, {
        method: "POST",
        body: {
          sub: account.sub,
          preferred_username: account.preferred_username,
          groups: account.groups,
          hasAntipanicButton: account.hasAntipanicButton,
        },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_session")?.value).toBe(token);
    expect(JSON.parse(calls.find((c) => c.path === "/auth/dev/login").body)).toEqual({
      sub,
      preferred_username: account.preferred_username,
      groups,
    });
    expect(json.user).toMatchObject({ sub, groups, hasAntipanicButton: account.hasAntipanicButton });
    expect(getHomePathForUser(json.user)).toBe(home);
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

    const res = await POST(makeRequest(LOGIN_URL, { method: "POST", body: DEV_LOGIN_BODY }));
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

    const res = await POST(
      makeRequest(LOGIN_URL, {
        method: "POST",
        body: { ...DEV_LOGIN_BODY, hasAntipanicButton: true },
      })
    );
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

  it("sin sub: propaga el 400 del backend sin setear cookie", async () => {
    mockBackend({
      "POST /auth/dev/login": {
        status: 400,
        body: { error: "ValidationError", message: "sub is required" },
      },
    });

    const res = await POST(
      makeRequest(LOGIN_URL, { method: "POST", body: { groups: ["citizen"] } })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toBe("sub is required");
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

    const req = makeRequest(LOGIN_URL, { method: "POST", body: DEV_LOGIN_BODY });

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
    expect(json.user.sub).toBe("U000042");
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

// El Login Federado es un servicio externo: si no responde, el login no puede
// quedar colgado. La ruta corta a los 8 s (AbortSignal.timeout) y devuelve 504;
// los demás errores del IdP se siguen informando como antes.
describe("POST /api/auth/login con loginType ldap: el IdP no responde o falla", () => {
  const originalFetch = global.fetch;
  let timeoutSpy;

  // Usuario y contraseña inventados: el IdP está mockeado.
  const ldapRequest = () =>
    makeRequest(LOGIN_URL, {
      method: "POST",
      body: { username: "usuario-de-prueba", password: "x", loginType: "ldap" },
    });

  const TIMEOUT_BODY = {
    error: "Gateway Timeout",
    message: "El Login Federado no responde. Probá de nuevo.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
    vi.useFakeTimers();
    timeoutSpy = fakeAbortSignalTimeout();
  });

  afterEach(() => {
    timeoutSpy.mockRestore();
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("sin respuesta: espera 8 s, devuelve 504 con mensaje claro y no setea cookies", async () => {
    const { calls } = mockHangingFetch();

    let settled = false;
    const pending = POST(ldapRequest()).finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual(TIMEOUT_BODY);
    expect(res.cookies.get("citypass_session")).toBeUndefined();
    expect(res.cookies.get("citypass_refresh")).toBeUndefined();
    expect(timeoutSpy).toHaveBeenCalledWith(8000);
    // Una sola llamada, al IdP: no reintenta ni cae al login del backend.
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/auth/login");
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("responde los headers y se cuelga el cuerpo: también 504", async () => {
    mockHangingFetch({ afterHeaders: true });

    const pending = POST(ldapRequest());
    await vi.advanceTimersByTimeAsync(8000);
    const res = await pending;

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual(TIMEOUT_BODY);
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("error de red (no es timeout): sigue siendo 502 con el mensaje de siempre", async () => {
    mockBackend({ "POST /auth/login": "network-error" });

    const res = await POST(ldapRequest());
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.message).toBe("No se pudo conectar con el servidor de Login Federado (LDAP).");
  });

  it("429 del LDAP: lo identifica como del Login Federado y no setea cookies", async () => {
    mockBackend({
      "POST /auth/login": { status: 429, body: { message: "Too many requests" } },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await POST(ldapRequest());
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get("X-Rate-Limited-By")).toBe("ldap");
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(json).toEqual({
      error: "TooManyRequests",
      reason: "idp_rate_limited",
      source: "ldap",
      retryAfterSeconds: null,
      message:
        "El Login Federado (LDAP) está limitando los ingresos de esta app. Probá de nuevo en unos minutos.",
    });
    expect(res.cookies.get("citypass_session")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[ldap] 429 del Login Federado en /auth/login"));
    warn.mockRestore();
  });

  it("credenciales inválidas con cuerpo que no es JSON: propaga el status del IdP", async () => {
    // El .catch de res.json() solo deja pasar el timeout; cualquier otro
    // error de parseo sigue tratándose como "sin cuerpo".
    global.fetch = vi.fn(async () => ({
      status: 401,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));

    const res = await POST(ldapRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.message).toBe("Usuario o contraseña inválidos en LDAP");
  });
});
