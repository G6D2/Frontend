// Integración: /api/analytics/[[...path]] (app/api/analytics/[[...path]]/route.js)
//
// Proxy del embed de analítica: agrega `Authorization: Bearer <cookie>` (el
// iframe no puede mandar headers), solo para dispatchers, solo GET/HEAD, y
// reescribe las URLs del HTML para que sigan pasando por el proxy.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET } from "../../app/api/analytics/[[...path]]/route.js";
import { DEFAULT_ANALYTICS_EMBED_URL } from "../../app/lib/analytics.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

const ORIGIN = new URL(DEFAULT_ANALYTICS_EMBED_URL).origin;

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const exp = Math.floor(Date.now() / 1000) + 900;
const DISPATCHER = jwtFor({ sub: "D1", groups: ["dispatcher"], exp });
const CITIZEN = jwtFor({ sub: "C1", groups: ["citizen"], exp });

const ctxFor = (path) => ({ params: Promise.resolve({ path }) });

describe("/api/analytics/[[...path]]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin cookie: 401 y no llama al servicio de analítica", async () => {
    mockNextCookies(cookies);
    const { calls } = mockBackend({});
    const res = await GET(makeRequest("http://localhost/api/analytics/embed/"), ctxFor(["embed"]));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("usuario que no es dispatcher: 403", async () => {
    mockNextCookies(cookies, { citypass_session: CITIZEN });
    const { calls } = mockBackend({});
    const res = await GET(makeRequest("http://localhost/api/analytics/embed/"), ctxFor(["embed"]));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("dispatcher: manda el Bearer al host de analítica y reescribe las URLs del HTML", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    const html =
      `<link href="/static/app.css"><script src="${ORIGIN}/static/app.js"></script>` +
      `<img src="logo.png"><a href="//cdn.example.com/x">x</a>`;
    const { calls } = mockBackend({
      "GET /embed/": { status: 200, body: html, headers: { "content-type": "text/html; charset=utf-8" } },
    });

    const res = await GET(makeRequest("http://localhost/api/analytics/embed/?range=7d"), ctxFor(["embed"]));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(calls[0].url).toBe(`${ORIGIN}/embed/?range=7d`);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${DISPATCHER}`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(text).toContain('href="/api/analytics/static/app.css"');
    expect(text).toContain('src="/api/analytics/static/app.js"');
    expect(text).toContain('src="logo.png"');
    expect(text).toContain('href="//cdn.example.com/x"');
  });

  it("Next saca la barra final: igual pide /embed/ y ancla las URLs relativas con <base>", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    const { calls } = mockBackend({
      "GET /embed/": { status: 200, body: "<html><head><title>x</title></head></html>", headers: { "content-type": "text/html" } },
    });
    const res = await GET(makeRequest("http://localhost/api/analytics/embed"), ctxFor(["embed"]));
    expect(calls[0].url).toBe(`${ORIGIN}/embed/`);
    expect(await res.text()).toContain('<head><base href="/api/analytics/embed/">');
  });

  it("rechaza segmentos con '..'", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    const { calls } = mockBackend({});
    const res = await GET(makeRequest("http://localhost/api/analytics/x"), ctxFor(["..", "etc"]));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("redirect a otro host: no lo sigue (no filtra el Bearer)", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({
      "GET /old": { status: 302, body: "", headers: { location: "https://evil.example.com/" } },
    });
    const res = await GET(makeRequest("http://localhost/api/analytics/old"), ctxFor(["old"]));
    expect(res.status).toBe(502);
  });

  it("redirect dentro del host: lo reescribe al proxy", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({
      "GET /old": { status: 301, body: "", headers: { location: "/embed/" } },
    });
    const res = await GET(makeRequest("http://localhost/api/analytics/old"), ctxFor(["old"]));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/api/analytics/embed/");
  });

  it("servicio caído: 502", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({ "GET /embed/": "network-error" });
    const res = await GET(makeRequest("http://localhost/api/analytics/embed/"), ctxFor(["embed"]));
    expect(res.status).toBe(502);
  });
});
