// Integración: GET /api/analitica (app/api/analitica/route.js)
//
// El iframe de /ops/analitica pega acá. La cookie se reenvía como Bearer al
// backend y el HTML vuelve con las cabeceras de Analítica, sin cachear.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET } from "../../app/api/analitica/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({ sub: "DISP-1", groups: ["dispatcher"], exp: Math.floor(Date.now() / 1000) + 900 });
const HTML = "<!doctype html><html><script id=\"citypass-datos\"></script></html>";

describe("GET /api/analitica", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin cookie: 401 y no llama al backend", async () => {
    mockNextCookies(cookies);
    const { calls } = mockBackend({});

    const res = await GET(makeRequest("http://localhost/api/analitica"));

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("reenvía el Bearer y devuelve el HTML con las cabeceras de Analítica", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    const { calls } = mockBackend({
      "GET /admin/analitica": {
        status: 200,
        body: HTML,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
          "content-security-policy": "default-src 'none'",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        },
      },
    });

    const res = await GET(makeRequest("http://localhost/api/analitica"));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(HTML);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/admin/analitica");
    expect(calls[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].headers.accept).toBe("text/html");
    expect(calls[0].url).not.toContain(TOKEN);
  });
});
