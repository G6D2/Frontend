// Integración: /api/backend/[...path] (app/api/backend/[...path]/route.js)
//
// Proxy autenticado hacia el backend: reenvía método/headers/body con
// `Authorization: Bearer <cookie>`, propaga status/body de la respuesta, y si
// el backend devuelve 401 limpia la cookie de sesión (token vencido/revocado).
// Solo deja pasar las rutas y métodos que usa el front (allowlist), y no
// reintenta los POST/PATCH cuando no se sabe si el backend los procesó.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET, POST, PATCH, PUT, DELETE } from "../../app/api/backend/[...path]/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({ sub: "U1", groups: ["citizen"], exp: Math.floor(Date.now() / 1000) + 900 });

function ctxFor(path) {
  return { params: Promise.resolve({ path }) };
}

describe("/api/backend/[...path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin cookie: responde 401 y no llama al backend", async () => {
    mockNextCookies(cookies);
    const { calls } = mockBackend({});

    const req = makeRequest("http://localhost/api/backend/api/emergencies");
    const res = await GET(req, ctxFor(["api","emergencies"]));

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("con cookie: reenvía Authorization: Bearer <token> y el método al backend", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "GET /api/emergencies": { status: 200, body: { data: [] } },
    });

    const req = makeRequest("http://localhost/api/backend/api/emergencies");
    const res = await GET(req, ctxFor(["api","emergencies"]));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ data: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].method).toBe("GET");
  });

  it("preserva la query string en un GET", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "GET /api/emergencies": { status: 200, body: { data: [] } },
    });

    const req = makeRequest("http://localhost/api/backend/api/emergencies?status=activa&page=2");
    await GET(req, ctxFor(["api","emergencies"]));

    expect(calls[0].url).toContain("?status=activa&page=2");
  });

  // /ops/historial (issue #46) pide varios estados terminales en una sola
  // llamada, separados por coma (el controller del backend hace
  // status.split(',') y filtra con status = ANY(...), ver
  // src/controllers/emergency.controller.js en emergencias-backend) en vez
  // de una llamada por estado. Este test confirma que el proxy no rompe esa
  // lista al reenviarla, y que devuelve `pagination` intacta para el
  // "Cargar más" del historial.
  it("listado con filtro de varios estados (historial): reenvía status=A,B,C y devuelve data + pagination", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "GET /api/emergencies": {
        status: 200,
        body: {
          data: [
            { id: "e1", status: "CLOSED", closedAt: "2026-09-19T10:00:00Z" },
            { id: "e2", status: "DISCARDED", closedAt: "2026-09-18T10:00:00Z" },
          ],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        },
      },
    });

    const req = makeRequest(
      "http://localhost/api/backend/api/emergencies?status=CLOSED,CANCELLED,DISCARDED,RESOLVED&page=1&limit=20&sortBy=createdAt&order=desc"
    );
    const res = await GET(req, ctxFor(["api","emergencies"]));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls[0].url).toContain("status=CLOSED,CANCELLED,DISCARDED,RESOLVED");
    expect(json.data).toHaveLength(2);
    expect(json.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("POST: reenvía el body y genera Idempotency-Key para el backend", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "POST /api/panic-button": { status: 201, body: { id: "E1" } },
    });

    const req = makeRequest("http://localhost/api/backend/api/panic-button", {
      method: "POST",
      body: { lat: -34.6, lng: -58.4 },
    });
    const res = await POST(req, ctxFor(["api","panic-button"]));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: "E1" });
    expect(JSON.parse(calls[0].body)).toEqual({ lat: -34.6, lng: -58.4 });
    expect(calls[0].headers["idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("POST: preserva Idempotency-Key enviada por el cliente", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "POST /api/panic-button": { status: 201, body: { id: "E1" } },
    });

    const req = makeRequest("http://localhost/api/backend/api/panic-button", {
      method: "POST",
      body: { lat: -34.6, lng: -58.4 },
      headers: { "Idempotency-Key": "client-key-abc" },
    });
    const res = await POST(req, ctxFor(["api","panic-button"]));
    expect(res.status).toBe(201);
    expect(calls[0].headers["idempotency-key"]).toBe("client-key-abc");
  });

  it("backend 401: responde 401 y borra la cookie de sesión", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({
      "GET /api/emergencies": {
        status: 401,
        body: { error: "Unauthorized", message: "token vencido" },
      },
    });

    const req = makeRequest("http://localhost/api/backend/api/emergencies");
    const res = await GET(req, ctxFor(["api","emergencies"]));

    expect(res.status).toBe(401);
    const deleted = res.cookies.get("citypass_session");
    expect(deleted?.value).toBe("");
    expect(deleted?.maxAge).toBe(0);
  });

  // ── 403/429 que no salió del backend (lib/edge-block.js) ──────────────

  describe("bloqueo antes de llegar al backend", () => {
    const CHALLENGE_HTML =
      "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf-chl</body></html>";
    let warn;

    beforeEach(() => {
      mockNextCookies(cookies, { citypass_session: TOKEN });
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    const getEmergencies = () =>
      GET(
        makeRequest("http://localhost/api/backend/api/emergencies?status=PENDING"),
        ctxFor(["api", "emergencies"])
      );

    it("desafío de Cloudflare (cf-mitigated): 429 identificado, con cf-ray, y una línea [cloudflare] en el log", async () => {
      mockBackend({
        "GET /api/emergencies": {
          status: 429,
          body: CHALLENGE_HTML,
          headers: {
            "content-type": "text/html; charset=UTF-8",
            "cf-mitigated": "challenge",
            "cf-ray": "abc123-EZE",
            server: "cloudflare",
          },
        },
      });

      const res = await getEmergencies();
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(res.headers.get("X-Blocked-By")).toBe("cloudflare");
      expect(json).toEqual({
        error: "TooManyRequests",
        reason: "edge_blocked",
        source: "cloudflare",
        cfRay: "abc123-EZE",
        message: "Cloudflare bloqueó el pedido al backend: HTTP 429, cf-ray abc123-EZE",
      });
      const line = warn.mock.calls[0][0];
      expect(line).toMatch(/^\[cloudflare\] 429 en GET api\/emergencies antes de llegar al backend/);
      expect(line).toContain("cf-mitigated=challenge cf-ray=abc123-EZE");
      expect(line).toContain('cuerpo="Just a moment... cf-chl"');
      expect(line).not.toContain(TOKEN);
    });

    it("página de desafío sin cf-mitigated: también es Cloudflare", async () => {
      mockBackend({
        "GET /api/emergencies": {
          status: 403,
          body: CHALLENGE_HTML,
          headers: { "content-type": "text/html", server: "cloudflare" },
        },
      });

      const res = await getEmergencies();
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toMatchObject({ reason: "edge_blocked", source: "cloudflare", error: "Forbidden" });
    });

    it("429 sin JSON y sin marcas de Cloudflare: intermediario sin identificar (server: cloudflare no alcanza)", async () => {
      mockBackend({
        "GET /api/emergencies": {
          status: 429,
          body: "Too Many Requests",
          headers: { "content-type": "text/plain", server: "cloudflare", "retry-after": "60" },
        },
      });

      const res = await getEmergencies();
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(res.headers.get("X-Blocked-By")).toBe("edge");
      expect(res.headers.get("Retry-After")).toBe("60");
      expect(json.source).toBe("edge");
      expect(json.message).toBe("Un intermediario bloqueó el pedido antes de llegar al backend: HTTP 429");
      expect(warn.mock.calls[0][0]).toMatch(/^\[edge\] 429/);
    });

    it("429 en JSON del propio backend: pasa tal cual, sin marcar", async () => {
      mockBackend({
        "GET /api/emergencies": {
          status: 429,
          body: { error: "TooManyRequests", message: "Demasiadas solicitudes." },
        },
      });

      const res = await getEmergencies();

      expect(res.status).toBe(429);
      expect(res.headers.get("X-Blocked-By")).toBeNull();
      expect(await res.json()).toEqual({ error: "TooManyRequests", message: "Demasiadas solicitudes." });
      expect(warn).not.toHaveBeenCalled();
    });

    it("500 en HTML (no es 403/429): pasa tal cual", async () => {
      mockBackend({
        "GET /api/emergencies": {
          status: 500,
          body: "<html>oops</html>",
          headers: { "content-type": "text/html" },
        },
      });

      const res = await getEmergencies();

      expect(res.status).toBe(500);
      expect(res.headers.get("X-Blocked-By")).toBeNull();
    });
  });

  // ── Allowlist de rutas y métodos ─────────────────────────────────────

  describe("allowlist", () => {
    beforeEach(() => {
      mockNextCookies(cookies, { citypass_session: TOKEN });
    });

    it("path fuera de la allowlist (auth/dev/login): 404 y no llama al backend", async () => {
      const { calls } = mockBackend({});
      const req = makeRequest("http://localhost/api/backend/auth/dev/login", {
        method: "POST",
        body: { sub: "DISP-Demo001", groups: ["dispatcher"] },
      });
      const res = await POST(req, ctxFor(["auth", "dev", "login"]));

      expect(res.status).toBe(404);
      expect(calls).toHaveLength(0);
    });

    it("rutas del backend que el front no usa (api/user, api/incidents, api/outbox-events): 404", async () => {
      const { calls } = mockBackend({});
      for (const path of [["api", "user"], ["api", "incidents"], ["api", "outbox-events"]]) {
        const req = makeRequest(`http://localhost/api/backend/${path.join("/")}`);
        const res = await GET(req, ctxFor(path));
        expect(res.status).toBe(404);
      }
      expect(calls).toHaveLength(0);
    });

    it("no matchea por prefijo de texto: api/emergencies-admin no entra por api/emergencies", async () => {
      const { calls } = mockBackend({});
      const req = makeRequest("http://localhost/api/backend/api/emergencies-admin");
      const res = await GET(req, ctxFor(["api", "emergencies-admin"]));

      expect(res.status).toBe(404);
      expect(calls).toHaveLength(0);
    });

    it("contextos de zona activos (banner climático): GET pasa con la query; POST no", async () => {
      const { calls } = mockBackend({
        "GET /api/contextos-zona/activos": { status: 200, body: { data: [] } },
      });
      const get = await GET(
        makeRequest("http://localhost/api/backend/api/contextos-zona/activos?tipo=ALERTA_CLIMATICA"),
        ctxFor(["api", "contextos-zona", "activos"])
      );
      const post = await POST(
        makeRequest("http://localhost/api/backend/api/contextos-zona/activos", { method: "POST", body: {} }),
        ctxFor(["api", "contextos-zona", "activos"])
      );

      expect(get.status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("/api/contextos-zona/activos?tipo=ALERTA_CLIMATICA");
      expect(post.status).toBe(405);
    });

    it("segmentos con .. (decodificados o no): 400 y no llama al backend", async () => {
      const { calls } = mockBackend({});
      const attempts = [
        ["api", "emergencies", "..", "..", "auth", "dev", "login"],
        ["api", "emergencies", "../../auth/dev/login"], // ..%2F..%2F decodificado
        ["api", "emergencies", "..%2F..%2Fauth%2Fdev%2Flogin"], // sin decodificar
        ["api", "emergencies", "%2e%2e"],
        ["api", "emergencies", "."],
        ["api", "emergencies", "a\\..\\b"],
      ];
      for (const path of attempts) {
        const req = makeRequest("http://localhost/api/backend/api/emergencies/x", { method: "PATCH", body: {} });
        const res = await PATCH(req, ctxFor(path));
        expect(res.status, JSON.stringify(path)).toBe(400);
      }
      expect(calls).toHaveLength(0);
    });

    it("método que la ruta no usa (PUT/DELETE sobre emergencias): 405 con Allow y no llama al backend", async () => {
      const { calls } = mockBackend({});
      const put = await PUT(
        makeRequest("http://localhost/api/backend/api/emergencies/e1", { method: "PUT", body: {} }),
        ctxFor(["api", "emergencies", "e1"])
      );
      const del = await DELETE(
        makeRequest("http://localhost/api/backend/api/emergencies/e1", { method: "DELETE" }),
        ctxFor(["api", "emergencies", "e1"])
      );

      expect(put.status).toBe(405);
      expect(put.headers.get("allow")).toBe("GET, PATCH");
      expect(del.status).toBe(405);
      expect(calls).toHaveLength(0);
    });

    it("rutas que el front sí usa: PATCH cancel, PUT perfil y DELETE ubicación guardada (sin body)", async () => {
      const { calls } = mockBackend({
        "PATCH /api/emergencies/e1/cancel": { status: 200, body: { data: { id: "e1" } } },
        "PUT /api/citizen/profile": { status: 200, body: { data: {} } },
        "DELETE /api/citizen/saved-locations/l1": { status: 200, body: { data: { removed: true } } },
      });

      const cancel = await PATCH(
        makeRequest("http://localhost/api/backend/api/emergencies/e1/cancel", { method: "PATCH", body: {} }),
        ctxFor(["api", "emergencies", "e1", "cancel"])
      );
      const profile = await PUT(
        makeRequest("http://localhost/api/backend/api/citizen/profile", { method: "PUT", body: { phone: "1" } }),
        ctxFor(["api", "citizen", "profile"])
      );
      const del = await DELETE(
        makeRequest("http://localhost/api/backend/api/citizen/saved-locations/l1", { method: "DELETE" }),
        ctxFor(["api", "citizen", "saved-locations", "l1"])
      );

      expect(cancel.status).toBe(200);
      expect(profile.status).toBe(200);
      expect(del.status).toBe(200);
      expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
        "PATCH /api/emergencies/e1/cancel",
        "PUT /api/citizen/profile",
        "DELETE /api/citizen/saved-locations/l1",
      ]);
    });
  });

  // ── CSRF en POST/PATCH/PUT/DELETE (lib/csrf.js) ──────────────────────

  describe("csrf", () => {
    beforeEach(() => {
      mockNextCookies(cookies, { citypass_session: TOKEN });
    });

    it("POST con cookie válida pero desde otro origen: 403 y no llama al backend", async () => {
      const { calls } = mockBackend({});
      const req = makeRequest("https://citypass.test/api/backend/api/panic-button", {
        method: "POST",
        headers: { Host: "citypass.test", Origin: "https://evil.example" },
        body: { location: { latitude: -34.6, longitude: -58.4 } },
      });

      const res = await POST(req, ctxFor(["api", "panic-button"]));

      expect(res.status).toBe(403);
      expect(calls).toHaveLength(0);
    });

    it("POST con text/plain del mismo origen: 415", async () => {
      const { calls } = mockBackend({});
      const req = makeRequest("https://citypass.test/api/backend/api/panic-button", {
        method: "POST",
        headers: { Host: "citypass.test", Origin: "https://citypass.test", "Content-Type": "text/plain" },
        body: "{}",
      });

      const res = await POST(req, ctxFor(["api", "panic-button"]));

      expect(res.status).toBe(415);
      expect(calls).toHaveLength(0);
    });

    it("DELETE del mismo origen sin body ni Content-Type pasa; desde otro origen, 403", async () => {
      const { calls } = mockBackend({
        "DELETE /api/citizen/saved-locations/l1": { status: 200, body: { data: { removed: true } } },
      });
      const ctx = ctxFor(["api", "citizen", "saved-locations", "l1"]);
      const url = "https://citypass.test/api/backend/api/citizen/saved-locations/l1";

      const ok = await DELETE(
        makeRequest(url, { method: "DELETE", headers: { Host: "citypass.test", Origin: "https://citypass.test" } }),
        ctx
      );
      const evil = await DELETE(
        makeRequest(url, { method: "DELETE", headers: { Host: "citypass.test", Origin: "https://evil.example" } }),
        ctx
      );

      expect(ok.status).toBe(200);
      expect(evil.status).toBe(403);
      expect(calls).toHaveLength(1);
    });
  });

  // ── Reintentos (lib/backend-fetch.js) ────────────────────────────────

  describe("reintentos", () => {
    beforeEach(() => {
      mockNextCookies(cookies, { citypass_session: TOKEN });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("POST ante 504: no reintenta (el backend pudo haber creado el SOS) y devuelve el 504", async () => {
      const { calls } = mockBackend({
        "POST /api/panic-button": [
          { status: 504, body: { error: "Gateway Timeout" } },
          { status: 201, body: { id: "E-duplicada" } },
        ],
      });

      const req = makeRequest("http://localhost/api/backend/api/panic-button", {
        method: "POST",
        body: { location: { latitude: -34.6, longitude: -58.4 } },
      });
      const res = await POST(req, ctxFor(["api", "panic-button"]));

      expect(res.status).toBe(504);
      expect(calls).toHaveLength(1);
    });

    it("POST con la conexión cortada después de conectar: 502 sin reintentar", async () => {
      const { calls } = mockBackend({
        "POST /api/panic-button": ["network-error", { status: 201, body: { id: "E-duplicada" } }],
      });

      const req = makeRequest("http://localhost/api/backend/api/panic-button", {
        method: "POST",
        body: { location: { latitude: -34.6, longitude: -58.4 } },
      });
      const res = await POST(req, ctxFor(["api", "panic-button"]));

      expect(res.status).toBe(502);
      expect(calls).toHaveLength(1);
    });

    it("POST ante 502/503 (cold start de Render): reintenta con la misma Idempotency-Key", async () => {
      const { calls } = mockBackend({
        "POST /api/panic-button": [
          { status: 502, body: {} },
          { status: 503, body: {} },
          { status: 201, body: { id: "E1" } },
        ],
      });

      vi.useFakeTimers();
      const req = makeRequest("http://localhost/api/backend/api/panic-button", {
        method: "POST",
        body: { location: { latitude: -34.6, longitude: -58.4 } },
      });
      const pending = POST(req, ctxFor(["api", "panic-button"]));
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(4000);
      const res = await pending;

      expect(res.status).toBe(201);
      expect(calls).toHaveLength(3);
      expect(new Set(calls.map((c) => c.headers["idempotency-key"])).size).toBe(1);
    });

    it("GET ante 504: sí reintenta (es idempotente)", async () => {
      const { calls } = mockBackend({
        "GET /api/emergencies": [
          { status: 504, body: {} },
          { status: 200, body: { data: [] } },
        ],
      });

      vi.useFakeTimers();
      const pending = GET(
        makeRequest("http://localhost/api/backend/api/emergencies"),
        ctxFor(["api", "emergencies"])
      );
      await vi.advanceTimersByTimeAsync(4000);
      const res = await pending;

      expect(res.status).toBe(200);
      expect(calls).toHaveLength(2);
    });

    it("cada intento lleva su propio AbortSignal con timeout", async () => {
      const { calls } = mockBackend({
        "GET /api/emergencies": { status: 200, body: { data: [] } },
      });

      await GET(makeRequest("http://localhost/api/backend/api/emergencies"), ctxFor(["api", "emergencies"]));

      expect(calls[0].signal).toBeInstanceOf(AbortSignal);
      expect(calls[0].signal.aborted).toBe(false);
    });
  });
});
