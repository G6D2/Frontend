// Integración: /api/analytics (app/api/analytics/route.js)
//
// Proxy del tablero de analítica: agrega `Authorization: Bearer <cookie>` (el
// iframe no puede mandar headers), solo para dispatchers (el backend de
// analítica no valida roles) y solo para la URL fija del tablero.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET, HEAD } from "../../app/api/analytics/route.js";
import { DEFAULT_ANALYTICS_EMBED_URL } from "../../app/lib/analytics.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const exp = Math.floor(Date.now() / 1000) + 900;
const DISPATCHER = jwtFor({ sub: "D1", groups: ["dispatcher"], exp });
const CITIZEN = jwtFor({ sub: "C1", groups: ["citizen"], exp });
const OFFICER = jwtFor({ sub: "of-001", groups: ["officer"], exp });
const DELEGADO = jwtFor({ sub: "X1", groups: ["delegados"], exp });

const EMBED_PATH = new URL(DEFAULT_ANALYTICS_EMBED_URL).pathname;
const req = () => makeRequest("http://localhost/api/analytics");
const htmlResponse = (status = 200, html = "<html><body>tablero</body></html>") =>
  new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });

describe("/api/analytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("apunta por defecto al tablero de emergencias", () => {
    expect(EMBED_PATH).toBe("/embed/emergencias");
  });

  it("sin cookie: 401 y no llama al servicio de analítica", async () => {
    mockNextCookies(cookies);
    const { calls } = mockBackend({});
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ["ciudadano", CITIZEN],
    ["oficial", OFFICER],
    ["delegado", DELEGADO],
  ])("%s: 403 y no llama al servicio de analítica (el único filtro de rol es este)", async (_, token) => {
    mockNextCookies(cookies, { citypass_session: token });
    const { calls } = mockBackend({});
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("dispatcher: pide el tablero con el Bearer y devuelve el HTML sin tocar", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    const html = '<html><script>var d={"a":1}</script><link href="/x.css"></html>';
    const { calls } = mockBackend({ [`GET ${EMBED_PATH}`]: htmlResponse(200, html) });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(DEFAULT_ANALYTICS_EMBED_URL);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${DISPATCHER}`);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe(html);
  });

  it("propaga el status del servicio de analítica (p. ej. 401 si rechaza el token)", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({ [`GET ${EMBED_PATH}`]: htmlResponse(401, '{"detail":"Invalid token"}') });
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Invalid token");
  });

  it("no sigue redirects (no manda el Bearer a otro host)", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({
      [`GET ${EMBED_PATH}`]: new Response(null, { status: 302, headers: { location: "https://evil.example.com/" } }),
    });
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it("servicio caído: 502", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({ [`GET ${EMBED_PATH}`]: "network-error" });
    const res = await GET(req());
    expect(res.status).toBe(502);
  });

  it("HEAD: sin body", async () => {
    mockNextCookies(cookies, { citypass_session: DISPATCHER });
    mockBackend({ [`HEAD ${EMBED_PATH}`]: htmlResponse() });
    const res = await HEAD(makeRequest("http://localhost/api/analytics", { method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});
