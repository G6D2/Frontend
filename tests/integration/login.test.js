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
});
