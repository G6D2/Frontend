import { describe, it, expect, vi, afterEach } from "vitest";
import { getStoredUser, setStoredUser, clearStoredUser } from "../app/lib/auth";
import { loginWithPassword, fetchCurrentUser } from "../app/lib/api";

const USER_KEY = "citypass_user_profile";

// El perfil en sessionStorage es una copia de conveniencia: la sesión real es
// la cookie httpOnly. Con el storage bloqueado (cookies de terceros o "bloquear
// todo" en el navegador, iframes sandbox) o lleno, ni el login ni la carga del
// usuario pueden fallar por no poder guardar esa copia.
describe("perfil en sessionStorage (app/lib/auth.js)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubStorage(storage) {
    vi.stubGlobal("window", { location: { pathname: "/inicio", replace: vi.fn() } });
    vi.stubGlobal("sessionStorage", storage);
  }

  function workingStorage() {
    const store = new Map();
    return {
      getItem: vi.fn((key) => store.get(key) ?? null),
      setItem: vi.fn((key, value) => store.set(key, String(value))),
      removeItem: vi.fn((key) => store.delete(key)),
    };
  }

  /** Storage presente pero inutilizable: todas las operaciones tiran. */
  function throwingStorage() {
    const fail = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    return {
      getItem: vi.fn(fail),
      setItem: vi.fn(fail),
      removeItem: vi.fn(fail),
    };
  }

  /** El acceso a `sessionStorage` mismo tira (así falla en Chrome y Firefox
   * cuando el sitio tiene los datos bloqueados). */
  function stubBlockedStorageAccess() {
    stubStorage(undefined);
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access is denied for this document.", "SecurityError");
      },
    });
  }

  describe("con el storage disponible", () => {
    it("setStoredUser guarda solo los claims de sesión y getStoredUser los devuelve", () => {
      const storage = workingStorage();
      stubStorage(storage);

      setStoredUser({
        sub: "u1",
        preferred_username: "juan",
        groups: ["citizen"],
        hasAntipanicButton: 1,
        loginMethod: "sesion",
        email: "juan@example.com",
      });

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(getStoredUser()).toEqual({
        sub: "u1",
        username: "juan",
        groups: ["citizen"],
        hasAntipanicButton: true,
        loginMethod: "sesion",
      });
    });

    it("setStoredUser(null) y clearStoredUser borran el perfil", () => {
      const storage = workingStorage();
      stubStorage(storage);

      setStoredUser({ sub: "u1" });
      setStoredUser(null);
      expect(getStoredUser()).toBeNull();

      setStoredUser({ sub: "u1" });
      clearStoredUser();
      expect(getStoredUser()).toBeNull();
      expect(storage.removeItem).toHaveBeenCalledWith(USER_KEY);
    });
  });

  describe("con el storage bloqueado o lleno", () => {
    it("setStoredUser no tira si setItem falla", () => {
      const storage = throwingStorage();
      stubStorage(storage);

      expect(() => setStoredUser({ sub: "u1", groups: ["citizen"] })).not.toThrow();
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it("setStoredUser(null) y clearStoredUser no tiran si removeItem falla", () => {
      const storage = throwingStorage();
      stubStorage(storage);

      expect(() => setStoredUser(null)).not.toThrow();
      expect(() => clearStoredUser()).not.toThrow();
      expect(storage.removeItem).toHaveBeenCalledTimes(2);
    });

    it("ninguna de las tres tira si el acceso a sessionStorage mismo falla", () => {
      stubBlockedStorageAccess();

      expect(() => setStoredUser({ sub: "u1" })).not.toThrow();
      expect(() => setStoredUser(null)).not.toThrow();
      expect(() => clearStoredUser()).not.toThrow();
      expect(getStoredUser()).toBeNull();
    });

    it("el login devuelve el usuario aunque no se pueda guardar la copia", async () => {
      stubStorage(throwingStorage());
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ user: { sub: "u1", username: "juan", groups: ["citizen"] } }),
        })
      );

      await expect(
        loginWithPassword({ email: "juan@example.com", password: "secreta" })
      ).resolves.toEqual({
        user: { sub: "u1", username: "juan", groups: ["citizen"], loginMethod: "sesion" },
      });
    });

    it("fetchCurrentUser devuelve el usuario de la sesión aunque no haya storage", async () => {
      stubBlockedStorageAccess();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: { sub: "d1", username: "disp", groups: ["dispatcher"] } }),
        })
      );

      await expect(fetchCurrentUser()).resolves.toEqual({
        sub: "d1",
        username: "disp",
        groups: ["dispatcher"],
      });
    });
  });

  it("en el servidor (sin window) no toca el storage", () => {
    const storage = workingStorage();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("sessionStorage", storage);

    setStoredUser({ sub: "u1" });
    clearStoredUser();

    expect(getStoredUser()).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});
