import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentLocation, LocationError } from "../app/lib/api.js";

describe("getCurrentLocation & LocationError", () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  function setNavigator(val) {
    Object.defineProperty(global, "navigator", {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    delete global.window?.__lastCoords;
  });

  afterEach(() => {
    setNavigator(originalNavigator);
    global.window = originalWindow;
    delete global.window?.__lastCoords;
  });

  it("falla explícitamente con NOT_SUPPORTED si el navegador no tiene geolocation", async () => {
    setNavigator({});

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: expect.stringContaining("no soporta geolocalización"),
    });
  });

  it("falla explícitamente con PERMISSION_DENIED si el usuario deniega los permisos (code 1)", async () => {
    setNavigator({
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
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 2, message: "Position unavailable" });
        }),
      },
    });

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "POSITION_UNAVAILABLE",
      message: expect.stringContaining("Ubicación no disponible"),
    });
  });

  it("falla explícitamente con TIMEOUT si expira el tiempo de espera (code 3)", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 3, message: "Timeout" });
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
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 2, message: "Position unavailable" });
        }),
      },
    });

    try {
      await getCurrentLocation();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LocationError);
      expect(err.code).toBe("POSITION_UNAVAILABLE");
    }
  });

  it("resuelve con coordenadas reales y precise: true cuando getCurrentPosition es exitoso", async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: -34.6037,
              longitude: -58.3816,
              accuracy: 15,
            },
          });
        }),
      },
    });

    const loc = await getCurrentLocation();
    expect(loc.latitude).toBe(-34.6037);
    expect(loc.longitude).toBe(-58.3816);
    expect(loc.accuracy).toBe(15);
    expect(loc.precise).toBe(true);
  });

  it("utiliza window.__lastCoords si está definido en el entorno", async () => {
    global.window = {
      __lastCoords: {
        latitude: -34.7,
        longitude: -58.5,
        precise: true,
      },
    };

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
      setNavigator({ geolocation: { getCurrentPosition } });

      await getCurrentLocation({ enableHighAccuracy: false, timeout: 4000, maximumAge: 1000 });

      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 1000 }
      );
    });

    it("maneja un código de error desconocido o err sin code devolviendo err.message y POSITION_UNAVAILABLE", async () => {
      setNavigator({
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
      setNavigator({
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
