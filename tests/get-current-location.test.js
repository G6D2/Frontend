import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentLocation, LocationError } from "../app/lib/api.js";

// Desde Node 21 `globalThis.navigator` existe y es un getter sin setter:
// asignarlo directo tira TypeError. Por eso se stubbea con vi.stubGlobal
// (redefine la propiedad) y se restaura con vi.unstubAllGlobals(). Así el
// archivo corre igual en Node 20, 22 y 24.
describe("getCurrentLocation & LocationError", () => {
  beforeEach(() => {
    // Sin window: getCurrentLocation no debe tomar el atajo de __lastCoords.
    vi.stubGlobal("window", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falla explícitamente con NOT_SUPPORTED si el navegador no tiene geolocation", async () => {
    vi.stubGlobal("navigator", {});

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: expect.stringContaining("no soporta geolocalización"),
    });
  });

  it("falla explícitamente con PERMISSION_DENIED si el usuario deniega los permisos (code 1)", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "User denied Geolocation" });
        }),
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      message: expect.stringContaining("Permiso de ubicación denegado"),
    });
  });

  it("falla explícitamente con POSITION_UNAVAILABLE si la señal no está disponible (code 2)", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 2, message: "Position unavailable" });
        }),
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "POSITION_UNAVAILABLE",
      message: expect.stringContaining("no disponible"),
    });
  });

  it("falla explícitamente con TIMEOUT si expira el tiempo de espera (code 3)", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 3, message: "Timeout expired" });
        }),
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.stringContaining("Tiempo de espera agotado"),
    });
  });

  it("no devuelve nunca coordenadas fijas falsas (-34.6037, -58.3816) ante errores", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "Denied" });
        }),
      },
    });

    try {
      await getCurrentLocation();
      expect.unreachable("getCurrentLocation debió haber fallado");
    } catch (err) {
      expect(err).toBeInstanceOf(LocationError);
      expect(err.latitude).toBeUndefined();
      expect(err.longitude).toBeUndefined();
    }
  });

  it("resuelve con coordenadas reales y precise: true cuando getCurrentPosition es exitoso", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: -34.5889,
              longitude: -58.4112,
              accuracy: 15,
            },
          });
        }),
      },
    });

    const loc = await getCurrentLocation();
    expect(loc).toEqual({
      latitude: -34.5889,
      longitude: -58.4112,
      precise: true,
      accuracy: 15,
    });
  });

  it("utiliza window.__lastCoords si está definido en el entorno", async () => {
    vi.stubGlobal("window", {
      __lastCoords: {
        latitude: -34.7,
        longitude: -58.5,
        precise: true,
      },
    });

    const loc = await getCurrentLocation();
    expect(loc.latitude).toBe(-34.7);
    expect(loc.longitude).toBe(-58.5);
    expect(loc.precise).toBe(true);
  });

  describe("LocationError class y ramas adicionales", () => {
    it("instancia LocationError con código por defecto POSITION_UNAVAILABLE y guarda originalError", () => {
      const orig = new Error("error nativo");
      const errWithDefaults = new LocationError("fallo general");
      expect(errWithDefaults.name).toBe("LocationError");
      expect(errWithDefaults.code).toBe("POSITION_UNAVAILABLE");
      expect(errWithDefaults.message).toBe("fallo general");
      expect(errWithDefaults.originalError).toBeNull();

      const customErr = new LocationError("fallo específico", "NOT_SUPPORTED", orig);
      expect(customErr.code).toBe("NOT_SUPPORTED");
      expect(customErr.originalError).toBe(orig);
    });

    it("pasa las opciones personalizadas a navigator.geolocation.getCurrentPosition", async () => {
      const getCurrentPosition = vi.fn((success) => {
        success({
          coords: { latitude: -34.6, longitude: -58.4, accuracy: 20 },
        });
      });
      vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

      await getCurrentLocation({ enableHighAccuracy: false, timeout: 4000, maximumAge: 1000 });

      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 1000 }
      );
    });

    it("maneja un código de error desconocido o err sin code devolviendo err.message y POSITION_UNAVAILABLE", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 999, message: "Falla de hardware desconocida" });
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "POSITION_UNAVAILABLE",
        message: "Falla de hardware desconocida",
      });
    });

    it("maneja un error nulo/indefinido en el callback de error de geolocalización", async () => {
      vi.stubGlobal("navigator", {
        geolocation: {
          getCurrentPosition: vi.fn((_success, error) => {
            error(null);
          }),
        },
      });

      await expect(getCurrentLocation()).rejects.toMatchObject({
        code: "POSITION_UNAVAILABLE",
        message: "No se pudo obtener tu ubicación actual.",
      });
    });
  });
});
