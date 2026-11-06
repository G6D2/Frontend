// Integración: defensa CSRF de los POST del BFF (lib/csrf.js).
//
// El ataque que se cierra: otro sitio manda un POST `text/plain` (simple
// request, sin preflight CORS) a /api/auth/login con credenciales del
// atacante y el navegador de la víctima queda logueado con esa cuenta. Cada
// ruta mutante tiene que rechazar un Origin ajeno (403) y un Content-Type que
// no sea JSON (415) antes de tocar el backend. Los POST/PATCH del proxy
// /api/backend se cubren en backend-proxy.test.js.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST as login } from "../../app/api/auth/login/route.js";
import { POST as register } from "../../app/api/auth/register/route.js";
import { POST as logout } from "../../app/api/auth/logout/route.js";
import { POST as refresh } from "../../app/api/auth/refresh/route.js";
import { POST as forgotPassword } from "../../app/api/auth/forgot-password/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({ sub: "U1", groups: ["citizen"], exp: Math.floor(Date.now() / 1000) + 900 });

const SAME_ORIGIN = { Host: "citypass.test", Origin: "https://citypass.test" };
const EVIL_ORIGIN = { Host: "citypass.test", Origin: "https://evil.example" };

describe("CSRF en los POST de /api/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
  });

  it("login con text/plain desde otro origen (el ataque): 403 y no llama al backend", async () => {
    const { calls } = mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/login", {
      method: "POST",
      headers: { ...EVIL_ORIGIN, "Content-Type": "text/plain" },
      body: JSON.stringify({ email: "atacante@evil.example", password: "x" }),
    });

    const res = await login(req);

    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("login con JSON desde otro origen: 403", async () => {
    const { calls } = mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/login", {
      method: "POST",
      headers: EVIL_ORIGIN,
      body: { email: "a@b.com", password: "x" },
    });

    const res = await login(req);

    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("login con text/plain del mismo origen: 415", async () => {
    const { calls } = mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/login", {
      method: "POST",
      headers: { ...SAME_ORIGIN, "Content-Type": "text/plain" },
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });

    const res = await login(req);

    expect(res.status).toBe(415);
    expect(calls).toHaveLength(0);
  });

  it("login con Origin: null (iframe con sandbox): 403", async () => {
    mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/login", {
      method: "POST",
      headers: { Host: "citypass.test", Origin: "null" },
      body: { email: "a@b.com", password: "x" },
    });

    expect((await login(req)).status).toBe(403);
  });

  it("sin Origin pero con Sec-Fetch-Site: cross-site: 403", async () => {
    mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/login", {
      method: "POST",
      headers: { Host: "citypass.test", "Sec-Fetch-Site": "cross-site" },
      body: { email: "a@b.com", password: "x" },
    });

    expect((await login(req)).status).toBe(403);
  });

  it("login JSON del mismo origen (detrás de proxy con X-Forwarded-Host): pasa y setea la cookie", async () => {
    mockBackend({
      "POST /auth/login": { status: 200, body: { access_token: TOKEN, expires_in: 900 } },
      "GET /api/user": { status: 404, body: {} },
    });
    const req = makeRequest("http://10.0.0.5:3001/api/auth/login", {
      method: "POST",
      headers: {
        Host: "10.0.0.5:3001",
        "X-Forwarded-Host": "citypass.test",
        Origin: "https://citypass.test",
      },
      body: { email: "a@b.com", password: "x" },
    });

    const res = await login(req);

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_session")?.value).toBe(TOKEN);
  });

  it("register desde otro origen: 403 y no llama al backend", async () => {
    const { calls } = mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/register", {
      method: "POST",
      headers: EVIL_ORIGIN,
      body: { email: "a@b.com", password: "x" },
    });

    expect((await register(req)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("register con text/plain: 415", async () => {
    mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/register", {
      method: "POST",
      headers: { ...SAME_ORIGIN, "Content-Type": "text/plain" },
      body: "{}",
    });

    expect((await register(req)).status).toBe(415);
  });

  it("logout desde otro origen: 403 y no borra la cookie", async () => {
    const req = makeRequest("https://citypass.test/api/auth/logout", {
      method: "POST",
      headers: EVIL_ORIGIN,
    });

    const res = await logout(req);

    expect(res.status).toBe(403);
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("logout del mismo origen sin body ni Content-Type (como app/lib/api.js): 200", async () => {
    const req = makeRequest("https://citypass.test/api/auth/logout", {
      method: "POST",
      headers: SAME_ORIGIN,
    });

    const res = await logout(req);

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_session")?.maxAge).toBe(0);
  });

  it("refresh desde otro origen: 403, no llama al IdP y no toca las cookies", async () => {
    mockNextCookies(cookies, { citypass_refresh: "refresh-viejo" });
    const { calls } = mockBackend({});
    const req = makeRequest("https://citypass.test/api/auth/refresh", {
      method: "POST",
      headers: EVIL_ORIGIN,
    });

    const res = await refresh(req);

    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(res.cookies.get("citypass_session")).toBeUndefined();
    expect(res.cookies.get("citypass_refresh")).toBeUndefined();
  });

  it("refresh del mismo origen sin body ni Content-Type (como SessionRefreshManager): rota las cookies", async () => {
    mockNextCookies(cookies, { citypass_refresh: "refresh-viejo" });
    const { calls } = mockBackend({
      "POST /auth/refresh": {
        status: 200,
        body: { access_token: TOKEN, refresh_token: "refresh-nuevo", expires_in: 900 },
      },
    });
    const req = makeRequest("https://citypass.test/api/auth/refresh", {
      method: "POST",
      headers: SAME_ORIGIN,
    });

    const res = await refresh(req);

    expect(res.status).toBe(200);
    expect(JSON.parse(calls[0].body)).toEqual({ refreshToken: "refresh-viejo" });
    expect(res.cookies.get("citypass_session")?.value).toBe(TOKEN);
    expect(res.cookies.get("citypass_refresh")?.value).toBe("refresh-nuevo");
  });

  it("forgot-password desde otro origen: 403", async () => {
    const req = makeRequest("https://citypass.test/api/auth/forgot-password", {
      method: "POST",
      headers: EVIL_ORIGIN,
      body: { email: "a@b.com" },
    });

    expect((await forgotPassword(req)).status).toBe(403);
  });
});
