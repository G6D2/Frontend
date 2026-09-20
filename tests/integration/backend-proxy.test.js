// Integración: /api/backend/[...path] (app/api/backend/[...path]/route.js)
//
// Proxy autenticado hacia el backend: reenvía método/headers/body con
// `Authorization: Bearer <cookie>`, propaga status/body de la respuesta, y si
// el backend devuelve 401 limpia la cookie de sesión (token vencido/revocado).
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET, POST } from "../../app/api/backend/[...path]/route.js";
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

    const req = makeRequest("http://localhost/api/backend/emergencies");
    const res = await GET(req, ctxFor(["emergencies"]));

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("con cookie: reenvía Authorization: Bearer <token> y el método al backend", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "GET /emergencies": { status: 200, body: { data: [] } },
    });

    const req = makeRequest("http://localhost/api/backend/emergencies");
    const res = await GET(req, ctxFor(["emergencies"]));
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
      "GET /emergencies": { status: 200, body: { data: [] } },
    });

    const req = makeRequest("http://localhost/api/backend/emergencies?status=activa&page=2");
    await GET(req, ctxFor(["emergencies"]));

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
      "GET /emergencies": {
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
      "http://localhost/api/backend/emergencies?status=CLOSED,CANCELLED,DISCARDED,RESOLVED&page=1&limit=20&sortBy=createdAt&order=desc"
    );
    const res = await GET(req, ctxFor(["emergencies"]));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls[0].url).toContain("status=CLOSED,CANCELLED,DISCARDED,RESOLVED");
    expect(json.data).toHaveLength(2);
    expect(json.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("POST: reenvía el body al backend", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "POST /panic-button": { status: 201, body: { id: "E1" } },
    });

    const req = makeRequest("http://localhost/api/backend/panic-button", {
      method: "POST",
      body: { lat: -34.6, lng: -58.4 },
    });
    const res = await POST(req, ctxFor(["panic-button"]));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ id: "E1" });
    expect(JSON.parse(calls[0].body)).toEqual({ lat: -34.6, lng: -58.4 });
  });

  it("backend 401: responde 401 y borra la cookie de sesión", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({
      "GET /emergencies": {
        status: 401,
        body: { error: "Unauthorized", message: "token vencido" },
      },
    });

    const req = makeRequest("http://localhost/api/backend/emergencies");
    const res = await GET(req, ctxFor(["emergencies"]));

    expect(res.status).toBe(401);
    const deleted = res.cookies.get("citypass_session");
    expect(deleted?.value).toBe("");
    expect(deleted?.maxAge).toBe(0);
  });
});
