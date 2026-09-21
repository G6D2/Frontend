// Integración: GET /api/auth/session (app/api/auth/session/route.js)
//
// Cubre: sin cookie → 401; con cookie válida se lee el JWT (lib/jwt.js decodifica
// el payload sin verificar firma, ver lib/session.js `getServerSession`) y se
// intenta refrescar contra GET /api/user; si el backend no tiene el perfil (o
// falla), cae al usuario derivado del JWT.
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { GET } from "../../app/api/auth/session/route.js";
import { mockNextCookies, mockBackend } from "./helpers.js";

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

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin cookie: responde 401", async () => {
    mockNextCookies(cookies);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("con cookie válida y sin respuesta útil del backend: devuelve el user derivado del JWT (data.sub)", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({ "GET /api/user": { status: 404, body: {} } });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.sub).toBe("U1");
    expect(json.data.username).toBe("vecina1");
  });

  it("con cookie válida y backend OK: usa el perfil que devuelve /api/user", async () => {
    mockNextCookies(cookies, { citypass_session: TOKEN });
    mockBackend({
      "GET /api/user": {
        status: 200,
        body: { data: { sub: "U1", username: "vecina1", hasAntipanicButton: true } },
      },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ sub: "U1", hasAntipanicButton: true });
  });

  it("con cookie expirada: responde 401 (no llega a llamar al backend)", async () => {
    const expired = jwtFor({ sub: "U1", exp: Math.floor(Date.now() / 1000) - 60 });
    mockNextCookies(cookies, { citypass_session: expired });
    const { calls } = mockBackend({ "GET /api/user": { status: 200, body: { data: {} } } });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});
