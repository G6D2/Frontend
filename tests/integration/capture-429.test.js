// Integración: todo 429 que pasa por el servidor queda registrado una vez,
// con una línea "[429][origen]" (lib/log-429.js), y los que vio el navegador
// llegan por POST /api/telemetry/429 como "[429][browser]".
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST as telemetry } from "../../app/api/telemetry/429/route.js";
import { POST as register } from "../../app/api/auth/register/route.js";
import { GET as session } from "../../app/api/auth/session/route.js";
import { GET as warmup } from "../../app/api/warmup/route.js";
import { GET as analitica } from "../../app/api/analitica/route.js";
import { POST as logout } from "../../app/api/auth/logout/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({ sub: "DISP-1", groups: ["dispatcher"], exp: Math.floor(Date.now() / 1000) + 900 });
const SAME_ORIGIN = { Host: "citypass.test", Origin: "https://citypass.test" };
const JSON_429 = { status: 429, body: { error: "TooManyRequests", message: "Demasiadas solicitudes." } };

describe("captura de 429", () => {
  let warn;
  beforeEach(() => {
    vi.clearAllMocks();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const lines = () => warn.mock.calls.map((c) => c[0]);

  describe("POST /api/telemetry/429", () => {
    const post = (body, headers = SAME_ORIGIN) =>
      telemetry(makeRequest("https://citypass.test/api/telemetry/429", { method: "POST", body, headers }));

    it("cada evento del navegador queda como una línea [429][browser], hasta 20 por pedido", async () => {
      const event = {
        at: "2026-11-19T22:00:00.000Z",
        method: "GET",
        path: "/api/backend/api/emergencies",
        page: "/ops",
        status: 429,
        cfRay: "r1-EZE",
        cfMitigated: "challenge",
        contentType: "text/html",
        body: "<title>Just a moment...</title>",
      };
      const res = await post({ events: Array.from({ length: 25 }, () => event) });

      expect(res.status).toBe(204);
      expect(lines()).toHaveLength(20);
      const line = lines()[0];
      expect(line).toMatch(/^\[429\]\[browser\] GET \/api\/backend\/api\/emergencies /);
      expect(line).toContain("cf-ray=r1-EZE cf-mitigated=challenge");
      expect(line).toContain("2026-11-19T22:00:00.000Z");
      expect(line).toContain('cuerpo="Just a moment..."');
    });

    it("rechaza otro origen, cuerpos sin events y payloads grandes, sin escribir en el log", async () => {
      expect((await post({ events: [] }, { Host: "citypass.test", Origin: "https://evil.test" })).status).toBe(403);
      expect((await post({ nada: true })).status).toBe(400);
      expect((await post({ events: [{ body: "x".repeat(40_000) }] })).status).toBe(413);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it("register: 429 en JSON del backend → pasa con su mensaje, registrado y marcado", async () => {
    mockNextCookies(cookies);
    mockBackend({ "POST /auth/register": JSON_429 });

    const res = await register(
      makeRequest("https://citypass.test/api/auth/register", {
        method: "POST",
        headers: SAME_ORIGIN,
        body: { email: "a@b.c", password: "12345678" },
      })
    );

    expect(res.status).toBe(429);
    expect((await res.json()).message).toBe("Demasiadas solicitudes.");
    expect(res.headers.get("X-429-Logged")).toBe("1");
    expect(lines()[0]).toMatch(/^\[429\]\[backend\] POST \/auth\/register /);
  });

  it("register: bloqueo de Cloudflare → identificado", async () => {
    mockNextCookies(cookies);
    mockBackend({
      "POST /auth/register": { status: 429, body: "<title>Just a moment...</title>", headers: { "content-type": "text/html", "cf-mitigated": "challenge" } },
    });

    const res = await register(
      makeRequest("https://citypass.test/api/auth/register", {
        method: "POST",
        headers: SAME_ORIGIN,
        body: { email: "a@b.c", password: "12345678" },
      })
    );

    expect((await res.json())).toMatchObject({ reason: "edge_blocked", source: "cloudflare" });
    expect(lines()[0]).toMatch(/^\[429\]\[cloudflare\] POST \/auth\/register /);
  });

  it("session: 429 en /api/user → responde con los datos del token, pero lo registra", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({ "GET /api/user": JSON_429 });

    const res = await session();

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(lines()[0]).toMatch(/^\[429\]\[backend\] GET \/api\/user /);
  });

  it("warmup: 429 del tramo BFF → backend queda registrado aunque nadie lo vea", async () => {
    mockBackend({ "GET /": { status: 429, body: "Too Many Requests", headers: { "content-type": "text/plain", "cf-ray": "w1" } } });

    const res = await warmup();

    expect(await res.json()).toEqual({ warmed: true, status: 429 });
    expect(lines()[0]).toMatch(/^\[429\]\[edge\] GET \/ cf-ray=w1 /);
    expect(lines()[0]).toContain('nota="warmup"');
  });

  it("warmup: un 404 normal no registra nada", async () => {
    mockBackend({ "GET /": { status: 404, body: { error: "NotFoundError" } } });
    await warmup();
    expect(warn).not.toHaveBeenCalled();
  });

  it("analitica: 429 → pasa con su status, registrado y marcado", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({ "GET /admin/analitica": { status: 429, body: "<html>slow down</html>", headers: { "content-type": "text/html" } } });

    const res = await analitica(makeRequest("http://localhost/api/analitica"));

    expect(res.status).toBe(429);
    expect(res.headers.get("X-429-Logged")).toBe("1");
    expect(lines()[0]).toMatch(/^\[429\]\[analitica\] GET \/admin\/analitica /);
  });

  it("logout: 429 del IdP al revocar → registrado, y el logout local sigue", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN, citypass_refresh: "rt-1" });
    mockBackend({ "POST /auth/logout": { status: 429, body: {} } });

    const res = await logout(makeRequest("https://citypass.test/api/auth/logout", { method: "POST", headers: SAME_ORIGIN }));

    expect(res.status).toBe(200);
    expect(res.cookies.get("citypass_session")?.maxAge).toBe(0);
    expect(lines()[0]).toMatch(/^\[429\]\[ldap\] POST \/auth\/logout /);
  });
});
