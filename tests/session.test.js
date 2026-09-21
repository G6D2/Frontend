import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import {
  sessionCookieOptions,
  userFromJwt,
  readAccessToken,
  getServerSession,
} from "../lib/session";

function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const VALID_TOKEN = makeToken({
  sub: "U1",
  preferred_username: "testuser",
  groups: ["citizen"],
  exp: Math.floor(Date.now() / 1000) + 600,
});

const EXPIRED_TOKEN = makeToken({
  sub: "U1",
  groups: ["citizen"],
  exp: Math.floor(Date.now() / 1000) - 60,
});

describe("sessionCookieOptions", () => {
  it("returns httpOnly cookie options", () => {
    const opts = sessionCookieOptions(VALID_TOKEN);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("maxAge is positive for a valid (non-expired) token", () => {
    const opts = sessionCookieOptions(VALID_TOKEN);
    expect(opts.maxAge).toBeGreaterThan(0);
  });

  it("secure is false in non-production environment", () => {
    const opts = sessionCookieOptions(VALID_TOKEN);
    expect(opts.secure).toBe(false);
  });
});

describe("userFromJwt", () => {
  it("extracts user from a valid token", () => {
    const user = userFromJwt(VALID_TOKEN);
    expect(user).toMatchObject({
      sub: "U1",
      username: "testuser",
      groups: ["citizen"],
    });
  });

  it("returns null for an invalid token string", () => {
    expect(userFromJwt("not-a-jwt")).toBeNull();
  });

  it("returns null when token has no sub claim", () => {
    const token = makeToken({ groups: ["citizen"], exp: 9999999999 });
    expect(userFromJwt(token)).toBeNull();
  });

  it("falls back username to sub when preferred_username is absent", () => {
    const token = makeToken({ sub: "U2", groups: ["citizen"], exp: 9999999999 });
    const user = userFromJwt(token);
    expect(user.username).toBe("U2");
  });

  it("wraps groups in array when payload has no groups", () => {
    const token = makeToken({ sub: "U3", exp: 9999999999 });
    const user = userFromJwt(token);
    expect(Array.isArray(user.groups)).toBe(true);
    expect(user.groups).toHaveLength(0);
  });
});

describe("readAccessToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the cookie is absent", async () => {
    cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    expect(await readAccessToken()).toBeNull();
  });

  it("returns null when the token is expired", async () => {
    cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: EXPIRED_TOKEN }),
    });
    expect(await readAccessToken()).toBeNull();
  });

  it("returns the token when it is valid", async () => {
    cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: VALID_TOKEN }),
    });
    expect(await readAccessToken()).toBe(VALID_TOKEN);
  });
});

describe("getServerSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no valid cookie", async () => {
    cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    expect(await getServerSession()).toBeNull();
  });

  it("returns a session object for a valid token", async () => {
    cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: VALID_TOKEN }),
    });
    const session = await getServerSession();
    expect(session).toMatchObject({
      token: VALID_TOKEN,
      user: { sub: "U1", username: "testuser", groups: ["citizen"] },
    });
  });
});
