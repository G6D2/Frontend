import { describe, it, expect } from "vitest";
import {
  decodeJwtPayload,
  isTokenExpired,
  getTokenMaxAgeSeconds,
} from "../lib/jwt";
import {
  getHomePathForUser,
  isDispatcher,
  isDelegado,
  isOfficer,
} from "../app/lib/auth-roles";

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

  it("handles malformed payload or token without exp", () => {
    expect(decodeJwtPayload("header.invalid-base64.sig")).toBeNull();
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired("header.eyJuby1leHAiOnRydWV9.sig")).toBe(true);
    expect(getTokenMaxAgeSeconds(null, 500)).toBe(500);
    expect(getTokenMaxAgeSeconds("header.eyJuby1leHAiOnRydWV9.sig", 300)).toBe(300);
  });
});

describe("auth roles", () => {
  it("routes dispatcher to /ops", () => {
    expect(getHomePathForUser({ groups: ["dispatcher"] })).toBe("/ops");
    expect(isDispatcher({ groups: ["dispatcher"] })).toBe(true);
    expect(isDispatcher({ groups: ["Dispatcher"] })).toBe(true);
    expect(isDispatcher({ roles: ["dispatcher"] })).toBe(true);
    expect(isDispatcher({ roles: "dispatchers" })).toBe(true);
    expect(isDispatcher({ role: "operador" })).toBe(true);
    expect(isDispatcher({ groups: [null, 123] })).toBe(false);
    expect(isDispatcher(null)).toBe(false);
    expect(getHomePathForUser({ roles: ["dispatcher"] })).toBe("/ops");
  });

  it("routes delegado to LDAP panel", () => {
    expect(isDelegado({ groups: ["delegados"] })).toBe(true);
    expect(isDelegado({ group: "delegado" })).toBe(true);
    expect(isDelegado(null)).toBe(false);
    expect(getHomePathForUser({ groups: ["delegados"] })).toMatch(/citypass-login/);

    const prevUrl = process.env.NEXT_PUBLIC_LDAP_PANEL_URL;
    process.env.NEXT_PUBLIC_LDAP_PANEL_URL = "https://custom-ldap.org";
    expect(getHomePathForUser({ groups: ["delegados"] })).toBe("https://custom-ldap.org");
    if (prevUrl !== undefined) {
      process.env.NEXT_PUBLIC_LDAP_PANEL_URL = prevUrl;
    } else {
      delete process.env.NEXT_PUBLIC_LDAP_PANEL_URL;
    }
  });

  it("routes the LDAP officer group (poli) to /oficial, not /ops", () => {
    expect(isOfficer({ groups: ["poli"] })).toBe(true);
    expect(isOfficer({ groups: ["Poli"] })).toBe(true);
    expect(isDispatcher({ groups: ["poli"] })).toBe(false);
    expect(getHomePathForUser({ groups: ["poli"] })).toBe("/oficial");
  });

  it("routes citizen to /inicio", () => {
    expect(getHomePathForUser({ groups: ["citizen"] })).toBe("/inicio");
    expect(getHomePathForUser(null)).toBe("/inicio");
  });

  it("detects officer group", () => {
    expect(isOfficer({ groups: ["officer"] })).toBe(true);
    expect(isOfficer({ roles: ["officer"] })).toBe(true);
    expect(isOfficer({ role: "officer" })).toBe(true);
    expect(isOfficer({ group: "officer" })).toBe(true);
    expect(isOfficer({ groups: ["citizen"] })).toBe(false);
    expect(isOfficer(null)).toBe(false);
  });
});
