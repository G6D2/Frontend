import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSosController,
  SOS_COUNTDOWN_SECONDS,
  SOS_ADDRESS_TIMEOUT_MS,
} from "../app/lib/sosController";

// Deja correr la cola de microtareas pendiente (resoluciones de promesas
// encadenadas) sin avanzar el reloj falso.
async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("createSosController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports the expected defaults (3s de cuenta, 2.5s de timeout de dirección)", () => {
    expect(SOS_COUNTDOWN_SECONDS).toBe(3);
    expect(SOS_ADDRESS_TIMEOUT_MS).toBe(2500);
  });

  it("cuenta 3, 2, 1 y al llegar a 0 envía con la dirección ya resuelta", async () => {
    const states = [];
    const location = { latitude: -34.6, longitude: -58.4 };
    const getCurrentLocation = vi.fn().mockResolvedValue(location);
    const reverseGeocode = vi.fn().mockResolvedValue("Av. Siempre Viva 742");
    const onSubmit = vi.fn().mockResolvedValue({ emergencyId: "e1", message: "ok" });

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      onStateChange: (s) => states.push(s),
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    expect(controller.getState().phase).toBe("counting");
    expect(controller.getState().secondsLeft).toBe(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.getState().secondsLeft).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.getState().secondsLeft).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(location, "Av. Siempre Viva 742");
    expect(controller.getState().phase).toBe("success");
    expect(controller.getState().result).toEqual({ emergencyId: "e1", message: "ok" });

    // Pasó por "sending" en el medio.
    expect(states.some((s) => s.phase === "sending")).toBe(true);
  });

  it("cancelar durante la cuenta vuelve a idle y nunca llama a onSubmit", async () => {
    const getCurrentLocation = vi.fn().mockResolvedValue({ latitude: 1, longitude: 2 });
    const reverseGeocode = vi.fn().mockResolvedValue("dir");
    const onSubmit = vi.fn();

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.getState().secondsLeft).toBe(2);

    controller.cancel();
    expect(controller.getState().phase).toBe("idle");
    expect(controller.getState().secondsLeft).toBe(3);

    // Avanzar bastante más que la cuenta original: no debe dispararse el envío.
    await vi.advanceTimersByTimeAsync(5000);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("si la dirección tarda más que el timeout, envía sin address (null)", async () => {
    const location = { latitude: 1, longitude: 2 };
    const getCurrentLocation = vi.fn().mockResolvedValue(location);
    const reverseGeocode = vi.fn(() => new Promise(() => {})); // nunca resuelve
    const onSubmit = vi.fn().mockResolvedValue({ emergencyId: "e2" });

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(onSubmit).toHaveBeenCalledWith(location, null);
    expect(controller.getState().phase).toBe("success");
  });

  it("si la dirección llega antes de terminar la cuenta, la manda en el submit", async () => {
    const location = { latitude: 1, longitude: 2 };
    const getCurrentLocation = vi.fn().mockResolvedValue(location);
    const reverseGeocode = vi.fn().mockResolvedValue("Calle Falsa 123");
    const onSubmit = vi.fn().mockResolvedValue({ emergencyId: "e3" });

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 2500,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(3000);

    expect(onSubmit).toHaveBeenCalledWith(location, "Calle Falsa 123");
  });

  it("si falla la ubicación, aborta con error, no llama a onSubmit ni a reverseGeocode", async () => {
    const error = new Error("permiso denegado");
    const getCurrentLocation = vi.fn().mockRejectedValue(error);
    const reverseGeocode = vi.fn();
    const onSubmit = vi.fn();

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(controller.getState().phase).toBe("idle");
    expect(controller.getState().error).toBe(error);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(reverseGeocode).not.toHaveBeenCalled();

    // No debería quedar ningún timer vivo que dispare un envío tardío.
    await vi.advanceTimersByTimeAsync(5000);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("si falla el envío al backend, guarda el error y vuelve a idle", async () => {
    const location = { latitude: 1, longitude: 2 };
    const getCurrentLocation = vi.fn().mockResolvedValue(location);
    const reverseGeocode = vi.fn().mockResolvedValue("dir");
    const submitError = new Error("500");
    const onSubmit = vi.fn().mockRejectedValue(submitError);

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();

    expect(controller.getState().phase).toBe("idle");
    expect(controller.getState().error).toBe(submitError);
  });

  it("start() es un no-op mientras está contando o enviando", async () => {
    const getCurrentLocation = vi.fn().mockResolvedValue({ latitude: 1, longitude: 2 });
    const reverseGeocode = vi.fn().mockResolvedValue("dir");
    const onSubmit = vi.fn().mockResolvedValue({ emergencyId: "e4" });

    const controller = createSosController({
      getCurrentLocation,
      reverseGeocode,
      onSubmit,
      countdownSeconds: 3,
      addressTimeoutMs: 1000,
    });

    controller.start();
    controller.start();
    controller.start();

    await vi.advanceTimersByTimeAsync(3000);
    expect(getCurrentLocation).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("cancel() y reset() son no-ops en estado idle", () => {
    const controller = createSosController({
      getCurrentLocation: vi.fn(),
      reverseGeocode: vi.fn(),
      onSubmit: vi.fn(),
    });
    controller.cancel();
    expect(controller.getState().phase).toBe("idle");
    controller.reset();
    expect(controller.getState().phase).toBe("idle");
  });
});
