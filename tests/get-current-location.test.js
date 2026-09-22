import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentLocation, LocationError } from "../app/lib/api.js";

describe("getCurrentLocation & LocationError", () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    delete global.window?.__lastCoords;
  });

  afterEach(() => {
    global.navigator = originalNavigator;
    global.window = originalWindow;
    delete global.window?.__lastCoords;
  });

  it("falla explícitamente con NOT_SUPPORTED si el navegador no tiene geolocation", async () => {
    global.navigator = {};

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
      message: expect.stringContaining("no soporta geolocalización"),
    });
  });

  it("falla explícitamente con PERMISSION_DENIED si el usuario deniega los permisos (code 1)", async () => {
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "User denied Geolocation" });
        }),
      },
    };

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      message: expect.stringContaining("Permiso de ubicación denegado"),
    });
  });

  it("falla explícitamente con POSITION_UNAVAILABLE si la señal no está disponible (code 2)", async () => {
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 2, message: "Position unavailable" });
        }),
      },
    };

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "POSITION_UNAVAILABLE",
      message: expect.stringContaining("no disponible"),
    });
  });

  it("falla explícitamente con TIMEOUT si expira el tiempo de espera (code 3)", async () => {
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 3, message: "Timeout expired" });
        }),
      },
    };

    await expect(getCurrentLocation()).rejects.toThrow(LocationError);
    await expect(getCurrentLocation()).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.stringContaining("Tiempo de espera agotado"),
    });
  });

  it("no devuelve nunca coordenadas fijas falsas (-34.6037, -58.3816) ante errores", async () => {
    global.navigator = {
      geolocation: {
        getCurrentPosition: vi.fn((_success, error) => {
          error({ code: 1, message: "Denied" });
        }),
      },
    };

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
    global.navigator = {
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
    };

    const loc = await getCurrentLocation();
    expect(loc).toEqual({
      latitude: -34.5889,
      longitude: -58.4112,
      precise: true,
      accuracy: 15,
    });
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
});
