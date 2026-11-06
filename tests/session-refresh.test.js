import { describe, it, expect, vi } from "vitest";
import {
  createSessionRefresher,
  SESSION_REFRESH_INTERVAL_MS,
} from "../app/lib/sessionRefresh.js";

// Respuesta mínima como la de fetch: ok, status y json().
function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function setup(responses) {
  let clock = 1_000_000;
  const queue = [...responses];
  const refresh = vi.fn(async () => {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  });
  const onExpired = vi.fn();
  const refresher = createSessionRefresher({ refresh, onExpired, now: () => clock });
  return {
    refresher,
    refresh,
    onExpired,
    advance: (ms) => {
      clock += ms;
    },
  };
}

const NO_REFRESH_TOKEN = (sessionActive) =>
  response(401, { reason: "no_refresh_token", sessionActive });

describe("createSessionRefresher", () => {
  it("intervalo de 13 minutos", () => {
    expect(SESSION_REFRESH_INTERVAL_MS).toBe(13 * 60 * 1000);
  });

  it("refresh OK: no redirige y la vuelta a la pestaña no reintenta antes de 13 min", async () => {
    const { refresher, refresh, onExpired, advance } = setup([response(200, { success: true })]);

    expect(await refresher.tick()).toBe("refreshed");
    advance(SESSION_REFRESH_INTERVAL_MS - 1);
    expect(await refresher.onVisible()).toBe("skipped");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  describe("sesión local (sin refresh token: atajos demo, email/contraseña)", () => {
    it("no redirige mientras el token sigue vigente y no vuelve a pedir refresh", async () => {
      const { refresher, refresh, onExpired, advance } = setup([NO_REFRESH_TOKEN(true)]);

      expect(await refresher.tick()).toBe("local");
      expect(refresher.isLocalSession()).toBe(true);

      // Ni el timer ni la vuelta a la pestaña vuelven a llamar.
      advance(SESSION_REFRESH_INTERVAL_MS * 3);
      expect(await refresher.tick()).toBe("skipped");
      expect(await refresher.onVisible()).toBe("skipped");

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(onExpired).not.toHaveBeenCalled();
    });

    it("si el token local ya venció, redirige", async () => {
      const { refresher, onExpired } = setup([NO_REFRESH_TOKEN(false)]);

      expect(await refresher.tick()).toBe("expired");
      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it("reset() (pasar por /acceso) vuelve a habilitar el refresh para la sesión siguiente", async () => {
      const { refresher, refresh } = setup([NO_REFRESH_TOKEN(true), response(200)]);

      await refresher.tick();
      refresher.reset();

      expect(refresher.isLocalSession()).toBe(false);
      expect(await refresher.tick()).toBe("refreshed");
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  describe("sesión federada con refresh fallido", () => {
    it.each([
      ["el IdP rechazó el refresh token", response(401, { reason: "refresh_rejected", sessionActive: true })],
      ["el IdP no responde", response(502, { reason: "idp_error", sessionActive: true })],
    ])("%s con el token vigente: no redirige", async (_label, res) => {
      const { refresher, onExpired } = setup([res]);

      expect(await refresher.tick()).toBe("kept");
      expect(onExpired).not.toHaveBeenCalled();
    });

    it("anota el intento: la vuelta a la pestaña no reintenta hasta que pase otro intervalo", async () => {
      const { refresher, refresh, onExpired, advance } = setup([
        response(502, { reason: "idp_error", sessionActive: true }),
      ]);

      // Vuelve a la pestaña después de 20 min: intenta y falla.
      advance(20 * 60 * 1000);
      expect(await refresher.onVisible()).toBe("kept");
      // Cambios de pestaña siguientes: no reintenta (antes reintentaba en cada uno).
      advance(60_000);
      expect(await refresher.onVisible()).toBe("skipped");
      advance(60_000);
      expect(await refresher.onVisible()).toBe("skipped");
      // Pasado otro intervalo desde el intento fallido, sí.
      advance(SESSION_REFRESH_INTERVAL_MS);
      expect(await refresher.onVisible()).toBe("kept");

      expect(refresh).toHaveBeenCalledTimes(2);
      expect(onExpired).not.toHaveBeenCalled();
    });

    it("con el token vencido: redirige", async () => {
      const { refresher, onExpired } = setup([
        response(401, { reason: "refresh_rejected", sessionActive: false }),
      ]);

      expect(await refresher.tick()).toBe("expired");
      expect(onExpired).toHaveBeenCalledTimes(1);
    });
  });

  it("error de red hacia el BFF: no redirige y espera al próximo intervalo", async () => {
    const { refresher, refresh, onExpired, advance } = setup([new TypeError("fetch failed")]);

    expect(await refresher.tick()).toBe("kept");
    advance(1000);
    expect(await refresher.onVisible()).toBe("skipped");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("respuesta sin sessionActive (ej. 403 de CSRF): no redirige", async () => {
    const { refresher, onExpired } = setup([response(403, { error: "Forbidden" })]);

    expect(await refresher.tick()).toBe("kept");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("cuerpo que no es JSON: no redirige", async () => {
    const { refresher, onExpired } = setup([
      { ok: false, status: 500, json: async () => { throw new SyntaxError("no json"); } },
    ]);

    expect(await refresher.tick()).toBe("kept");
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("no superpone pedidos: un tick y una vuelta a la pestaña simultáneos hacen un solo refresh", async () => {
    let release;
    const refresh = vi.fn(
      () => new Promise((resolve) => { release = () => resolve(response(200)); })
    );
    let clock = 0;
    const refresher = createSessionRefresher({ refresh, onExpired: vi.fn(), now: () => clock });
    clock = SESSION_REFRESH_INTERVAL_MS;

    const first = refresher.tick();
    expect(await refresher.onVisible()).toBe("skipped");
    release();

    expect(await first).toBe("refreshed");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
