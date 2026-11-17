import { describe, it, expect } from "vitest";
import {
  ANTIPANIC_MODE,
  DEMO_ACCOUNTS,
  DISPATCHER_DEMO,
  DEMO_LOGIN_SHORTCUTS,
  findDemoAccount,
} from "../app/lib/features.js";
import { getHomePathForUser } from "../app/lib/auth-roles.js";

// Copia de DEV_LOGIN_ALLOWLIST del backend (src/auth/dev-login-policy.js).
// Con DEV_LOGIN_STRICT, /auth/dev/login rechaza cualquier otro sub con 400.
const BACKEND_DEV_LOGIN_ALLOWLIST = [
  "U000042",
  "CIT-JuanPanico",
  "CIT-LuciaTranquila",
  "DISP-Demo001",
  "of-001",
  "of-002",
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

  it("DISPATCHER_DEMO tiene grupo dispatcher", () => {
    expect(DISPATCHER_DEMO.groups).toContain("dispatcher");
    expect(DISPATCHER_DEMO.hasAntipanicButton).toBe(false);
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
  const bySub = Object.fromEntries(DEMO_LOGIN_SHORTCUTS.map((s) => [s.account.sub, s]));

  it("trae dispatcher, los dos oficiales y el ciudadano con SOS, en ese orden", () => {
    expect(DEMO_LOGIN_SHORTCUTS.map((s) => s.account.sub)).toEqual([
      "DISP-Demo001",
      "of-001",
      "of-002",
      "CIT-JuanPanico",
    ]);
  });

  it("cada sub está en la allowlist de /auth/dev/login del backend", () => {
    for (const { account } of DEMO_LOGIN_SHORTCUTS) {
      expect(BACKEND_DEV_LOGIN_ALLOWLIST).toContain(account.sub);
    }
  });

  it("los grupos coinciden con los que fija la allowlist del backend", () => {
    expect(bySub["DISP-Demo001"].account.groups).toEqual(["dispatcher"]);
    expect(bySub["of-001"].account.groups).toEqual(["officer"]);
    expect(bySub["of-002"].account.groups).toEqual(["officer"]);
    expect(bySub["CIT-JuanPanico"].account.groups).toEqual(["citizen"]);
  });

  it("solo el ciudadano demo tiene botón SOS", () => {
    expect(bySub["CIT-JuanPanico"].account.hasAntipanicButton).toBe(true);
    expect(bySub["DISP-Demo001"].account.hasAntipanicButton).toBe(false);
    expect(bySub["of-001"].account.hasAntipanicButton).toBe(false);
    expect(bySub["of-002"].account.hasAntipanicButton).toBe(false);
  });

  it("el dispatcher es el mismo DISPATCHER_DEMO del panel de atajos", () => {
    expect(bySub["DISP-Demo001"].account).toBe(DISPATCHER_DEMO);
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

  it("navegación por rol: dispatcher a /ops; oficiales y ciudadano a /inicio", () => {
    expect(getHomePathForUser(bySub["DISP-Demo001"].account)).toBe("/ops");
    // No hay home de oficial: el middleware lo trata como no-dispatcher.
    expect(getHomePathForUser(bySub["of-001"].account)).toBe("/oficial");
    expect(getHomePathForUser(bySub["of-002"].account)).toBe("/oficial");
    expect(getHomePathForUser(bySub["CIT-JuanPanico"].account)).toBe("/inicio");
  });
});
