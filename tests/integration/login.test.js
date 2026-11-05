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
});
