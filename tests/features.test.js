import { describe, it, expect } from "vitest";
import {
  ANTIPANIC_MODE,
  DEMO_ACCOUNTS,
  DISPATCHER_DEMO,
  findDemoAccount,
} from "../app/lib/features.js";

describe("features — constantes", () => {
  it("ANTIPANIC_MODE es 'mock' o 'backend'", () => {
    expect(["mock", "backend"]).toContain(ANTIPANIC_MODE);
  });

  it("DEMO_ACCOUNTS trae al menos una cuenta con los campos esperados", () => {
    expect(Array.isArray(DEMO_ACCOUNTS)).toBe(true);
    expect(DEMO_ACCOUNTS.length).toBeGreaterThan(0);
    for (const acc of DEMO_ACCOUNTS) {
      expect(acc).toEqual(
        expect.objectContaining({
          email: expect.any(String),
          password: expect.any(String),
          sub: expect.any(String),
          preferred_username: expect.any(String),
          groups: expect.any(Array),
          hasAntipanicButton: expect.any(Boolean),
        })
      );
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
