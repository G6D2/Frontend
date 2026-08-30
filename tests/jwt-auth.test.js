import { describe, it, expect } from "vitest";
import {
  decodeJwtPayload,
  isTokenExpired,
  getTokenMaxAgeSeconds,
} from "../lib/jwt";
import { getHomePathForUser, isDispatcher, isCitizen } from "../app/lib/auth-roles";

function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("jwt helpers", () => {
  it("decodes payload", () => {
    const token = makeToken({ sub: "U1", groups: ["citizen"], exp: 9999999999 });
    expect(decodeJwtPayload(token)).toMatchObject({
      sub: "U1",
      groups: ["citizen"],
    });
  });

  it("returns null for invalid token", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("detects expired tokens with skew", () => {
    const expired = makeToken({
      sub: "U1",
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(isTokenExpired(expired)).toBe(true);

    const valid = makeToken({
      sub: "U1",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    expect(isTokenExpired(valid)).toBe(false);
  });

  it("computes maxAge from exp", () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const token = makeToken({ sub: "U1", exp });
    const maxAge = getTokenMaxAgeSeconds(token);
    expect(maxAge).toBeGreaterThan(100);
    expect(maxAge).toBeLessThanOrEqual(120);
  });
});

describe("auth roles", () => {
  it("routes dispatcher to /ops", () => {
    expect(getHomePathForUser({ groups: ["dispatcher"] })).toBe("/ops");
    expect(isDispatcher({ groups: ["dispatcher"] })).toBe(true);
  });

  it("routes citizen to /inicio", () => {
    expect(getHomePathForUser({ groups: ["citizen"] })).toBe("/inicio");
    expect(isCitizen({ groups: ["citizen"] })).toBe(true);
  });
});
