// Integración: GET /api/geocode (app/api/geocode/route.js)
//
// Cubre: validación de lat/lng (400 si son inválidos o están fuera de rango)
// y el camino feliz con el proveedor externo (BigDataCloud) mockeado vía
// `global.fetch` — la ruta llama a `reverseGeocodeServer` (lib/geocode-server.js)
// sin inyectar `fetchImpl`, así que acá no queda otra que mockear el fetch global.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { GET } from "../../app/api/geocode/route.js";
import { _resetGeocodeState } from "../../lib/geocode-server.js";
import { mockBackend, makeRequest } from "./helpers.js";

const originalFetch = global.fetch;

describe("GET /api/geocode", () => {
  beforeEach(() => {
    _resetGeocodeState();
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
  });
});
