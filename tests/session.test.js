import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import {
  sessionCookieOptions,
  refreshCookieOptions,
  readRefreshToken,
  readAccessToken,
  getServerSession,
  userFromJwt,
  REFRESH_COOKIE,
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

describe("refreshCookieOptions", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns defaults for refresh cookie options", () => {
    const opts = refreshCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(28800);
    expect(opts.secure).toBe(false);
  });

  it("accepts custom numeric maxAge and falls back for invalid types", () => {
    expect(refreshCookieOptions(3600).maxAge).toBe(3600);
    expect(refreshCookieOptions("invalid").maxAge).toBe(28800);
  });

  it("sets secure: true in production", () => {
    process.env.NODE_ENV = "production";
    const opts = refreshCookieOptions();
    expect(opts.secure).toBe(true);
  });
});

describe("readRefreshToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when refresh cookie is absent", async () => {
    cookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) });
    expect(await readRefreshToken()).toBeNull();
  });

  it("returns refresh token value when present", async () => {
    cookies.mockResolvedValue({
      get: vi.fn((name) => (name === REFRESH_COOKIE ? { value: "rt_123" } : undefined)),
    });
    expect(await readRefreshToken()).toBe("rt_123");
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

  it("aggregates groups, roles, role, and group properties", () => {
    const token = makeToken({
      sub: "U3",
      groups: "citizen",
      roles: ["dispatcher"],
      role: "admin",
      group: "staff",
      exp: 9999999999,
    });
    const user = userFromJwt(token);
    expect(user.groups).toEqual(["citizen", "dispatcher", "admin", "staff"]);
    expect(user.roles).toEqual(["dispatcher"]);
    expect(user.role).toBe("admin");
  });

  it("wraps groups in array when payload has no groups", () => {
    const token = makeToken({ sub: "U4", exp: 9999999999 });
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

  it("returns null if token in cookie cannot be parsed as user", async () => {
    const tokenNoSub = makeToken({ exp: Math.floor(Date.now() / 1000) + 600 });
    cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: tokenNoSub }),
    });
    expect(await getServerSession()).toBeNull();
  });
});
