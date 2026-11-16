import { describe, it, expect } from "vitest";
import {
  ANTIPANIC_MODE,
  DEMO_ACCOUNTS,
  DEMO_LOGIN_SHORTCUTS,
  findDemoAccount,
} from "../app/lib/features.js";
import { getHomePathForUser } from "../app/lib/auth-roles.js";

// Copia de DEV_LOGIN_ALLOWLIST del backend (src/auth/dev-login-policy.js).
// Con DEV_LOGIN_STRICT, /auth/dev/login rechaza cualquier otro sub con 400.
// Solo ciudadanos: dispatcher y oficiales entran por el Login Federado.
const BACKEND_DEV_LOGIN_ALLOWLIST = [
  "U000042",
  "CIT-JuanPanico",
  "CIT-LuciaTranquila",
];

describe("features — constantes", () => {
  it("ANTIPANIC_MODE es 'mock' o 'backend'", () => {
    expect(["mock", "backend"]).toContain(ANTIPANIC_MODE);
  });

  it("DEMO_ACCOUNTS trae al menos una cuenta con los campos esperados (sin password en el bundle)", () => {
    expect(Array.isArray(DEMO_ACCOUNTS)).toBe(true);
    expect(DEMO_ACCOUNTS.length).toBeGreaterThan(0);
    for (const acc of DEMO_ACCOUNTS) {
      expect(acc).toEqual(
        expect.objectContaining({
          email: expect.any(String),
          sub: expect.any(String),
          preferred_username: expect.any(String),
          groups: expect.any(Array),
          hasAntipanicButton: expect.any(Boolean),
        })
      );
      expect(acc).not.toHaveProperty("password");
    }
  });
});

describe("findDemoAccount", () => {
  it("devuelve null si el email es null", () => {
    expect(findDemoAccount(null)).toBeNull();
  });

  it("devuelve null si el email es undefined", () => {
    expect(findDemoAccount(undefined)).toBeNull();
  });

  it("devuelve null si el email es string vacío", () => {
    expect(findDemoAccount("")).toBeNull();
  });

  it("devuelve null si el email no matchea ninguna cuenta demo", () => {
    expect(findDemoAccount("nadie@nadie.com")).toBeNull();
  });

  it("encuentra la cuenta por email exacto", () => {
    const acc = findDemoAccount("juanpanico@gmail.com");
    expect(acc).not.toBeNull();
    expect(acc.sub).toBe("CIT-JuanPanico");
    expect(acc.hasAntipanicButton).toBe(true);
  });

  it("es case-insensitive", () => {
    const acc = findDemoAccount("JUANPANICO@GMAIL.COM");
    expect(acc).not.toBeNull();
    expect(acc.sub).toBe("CIT-JuanPanico");
  });

  it("recorta espacios al inicio y final", () => {
    const acc = findDemoAccount("  luciatranquila@gmail.com  ");
    expect(acc).not.toBeNull();
    expect(acc.sub).toBe("CIT-LuciaTranquila");
    expect(acc.hasAntipanicButton).toBe(false);
  });
});

describe("DEMO_LOGIN_SHORTCUTS (atajos sin contraseña de /acceso)", () => {
  it("trae solo al ciudadano con SOS", () => {
    expect(DEMO_LOGIN_SHORTCUTS.map((s) => s.account.sub)).toEqual(["CIT-JuanPanico"]);
  });

  it("ningún atajo da rol de personal: /auth/dev/login es público y sin contraseña", () => {
    for (const { account } of DEMO_LOGIN_SHORTCUTS) {
      expect(account.groups).toEqual(["citizen"]);
      expect(BACKEND_DEV_LOGIN_ALLOWLIST).toContain(account.sub);
    }
  });

  it("el ciudadano demo tiene botón SOS y va a /inicio", () => {
    const [{ account }] = DEMO_LOGIN_SHORTCUTS;
    expect(account.hasAntipanicButton).toBe(true);
    expect(getHomePathForUser(account)).toBe("/inicio");
  });

  it("ids únicos (son los ids de los botones) y sin password", () => {
    const ids = DEMO_LOGIN_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DEMO_LOGIN_SHORTCUTS) {
      expect(s.label).toEqual(expect.any(String));
      expect(s.icon).toEqual(expect.any(String));
      expect(s.account).not.toHaveProperty("password");
    }
  });
});
