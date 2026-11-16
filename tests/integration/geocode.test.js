// Integración: GET /api/geocode (app/api/geocode/route.js)
//
// Cubre: sin sesión → 401 (no es un geocoder público), validación de lat/lng
// (400 si son inválidos o están fuera de rango) y el camino feliz con el
// proveedor externo (BigDataCloud) mockeado vía `global.fetch` — la ruta llama
// a `reverseGeocodeServer` (lib/geocode-server.js) sin inyectar `fetchImpl`,
// así que acá no queda otra que mockear el fetch global.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET } from "../../app/api/geocode/route.js";
import { _resetGeocodeState } from "../../lib/geocode-server.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

const originalFetch = global.fetch;

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({ sub: "U1", groups: ["citizen"], exp: Math.floor(Date.now() / 1000) + 900 });

describe("GET /api/geocode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetGeocodeState();
    mockNextCookies(cookies, { citypass_session: TOKEN });
  });

  it("sin sesión: 401 (y no llama a ningún proveedor externo)", async () => {
    mockNextCookies(cookies);
    const { calls } = mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=-34.6&lng=-58.4");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("con la cookie vencida: 401", async () => {
    const expired = jwtFor({ sub: "U1", exp: Math.floor(Date.now() / 1000) - 60 });
    mockNextCookies(cookies, { citypass_session: expired });
    const { calls } = mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=-34.6&lng=-58.4");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("lat/lng fuera de rango: 400 (y no llama a ningún proveedor externo)", async () => {
    // Mock defensivo: si la validación tuviera una regresión y el route
    // intentara geocodificar, que el test explote en vez de pegarle a la red.
    const { calls } = mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=200&lng=-58.4");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("lat/lng no numéricos: 400", async () => {
    mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=abc&lng=xyz");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("sin parámetros: 400 (y no llama a ningún proveedor externo)", async () => {
    // Regresión: Number(null) === 0 y Number.isFinite(0) === true, así que
    // sin este chequeo explícito de presencia, una request sin lat/lng
    // pasaba la validación y geocodificaba (0,0) → "océano Atlántico".
    const { calls } = mockBackend({});
    const req = makeRequest("http://localhost/api/geocode");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("con lat pero sin lng: 400", async () => {
    mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=-34.6");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("lat/lng vacíos (string vacío): 400", async () => {
    const { calls } = mockBackend({});
    const req = makeRequest("http://localhost/api/geocode?lat=&lng=");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("lat/lng válidos con el proveedor externo mockeado: devuelve { label }", async () => {
    mockBackend({
      "GET /data/reverse-geocode-client": {
        status: 200,
        body: { locality: "San Telmo", city: "CABA", principalSubdivision: "Buenos Aires" },
      },
    });

    const req = makeRequest("http://localhost/api/geocode?lat=-34.6&lng=-58.4");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.label).toBe("San Telmo, CABA, Buenos Aires");
    // Una dirección resuelta sí se cachea en el navegador.
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });

  it.each([
    ["los dos proveedores caídos", "network-error", "network-error"],
    ["los dos proveedores responden 503", { status: 503, body: {} }, { status: 503, body: {} }],
    ["los proveedores responden sin dirección", { status: 200, body: {} }, { status: 200, body: {} }],
  ])("sin dirección (%s): { label: null } con Cache-Control: no-store", async (_label, bigDataCloud, nominatim) => {
    // Regresión: el `label: null` salía con max-age=3600 y el navegador lo
    // guardaba una hora, aunque el proveedor se recuperara al minuto.
    mockBackend({
      "GET /data/reverse-geocode-client": bigDataCloud,
      "GET /reverse": nominatim,
    });

    const req = makeRequest("http://localhost/api/geocode?lat=-34.6&lng=-58.4");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.label).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
