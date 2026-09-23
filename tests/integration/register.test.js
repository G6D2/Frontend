// Integración: POST /api/auth/register (app/api/auth/register/route.js)
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST } from "../../app/api/auth/register/route.js";
import { mockNextCookies, mockBackend, makeRequest } from "./helpers.js";

const REGISTER_URL = "http://localhost/api/auth/register";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const TOKEN = jwtFor({
  sub: "U9",
  preferred_username: "nuevo",
  groups: ["citizen"],
  exp: Math.floor(Date.now() / 1000) + 900,
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNextCookies(cookies);
  });

  it("register OK: setea cookie y devuelve user", async () => {
    mockBackend({
      "POST /auth/register": {
        status: 200,
        body: { access_token: TOKEN, expires_in: 900 },
      },
    });

    const req = makeRequest(REGISTER_URL, {
      method: "POST",
      body: {
        email: "nuevo@city.com",
        password: "secret",
        preferred_username: "nuevo",
      },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({ sub: "U9", username: "nuevo" });
    expect(res.cookies.get("citypass_session")?.value).toBe(TOKEN);
  });

  it("JSON inválido: 400", async () => {
    const req = new Request(REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{no-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("backend 409: propaga el error sin cookie", async () => {
    mockBackend({
      "POST /auth/register": {
        status: 409,
        body: { error: "Conflict", message: "Email ya registrado" },
      },
    });

    const req = makeRequest(REGISTER_URL, {
      method: "POST",
      body: { email: "dup@city.com", password: "x" },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.message).toBe("Email ya registrado");
    expect(res.cookies.get("citypass_session")).toBeUndefined();
  });

  it("sin access_token: 502", async () => {
    mockBackend({
      "POST /auth/register": { status: 200, body: { expires_in: 900 } },
    });

    const req = makeRequest(REGISTER_URL, {
      method: "POST",
      body: { email: "a@b.com", password: "x" },
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
