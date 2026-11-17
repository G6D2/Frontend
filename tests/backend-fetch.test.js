import { describe, it, expect } from "vitest";
import {
  fetchBackend,
  isRetryableStatus,
  isRetryableError,
  isConnectError,
  generateIdempotencyKey,
} from "../lib/backend-fetch.js";

// Errores como los arma undici (fetch de Node): TypeError("fetch failed")
// con el motivo real en `cause.code`.
function fetchFailed(code) {
  const error = new TypeError("fetch failed");
  if (code) error.cause = Object.assign(new Error(code), { code });
  return error;
}

function responder(statuses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (status === "network") throw new TypeError("fetch failed");
    if (status === "refused") throw fetchFailed("ECONNREFUSED");
    if (status === "reset") throw fetchFailed("UND_ERR_SOCKET");
    if (status === "timeout") throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    return { status, ok: status < 400 };
  };
  return { fetchImpl, calls };
}

describe("fetchBackend", () => {
  it("devuelve la primera respuesta si no es 502/503/504", async () => {
    const { fetchImpl, calls } = responder([200]);
    const res = await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("reintenta mientras el backend responde 502 y devuelve el 200 final", async () => {
    const { fetchImpl, calls } = responder([502, 503, 200]);
    const res = await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0, retries: 5 });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it("no reintenta errores de aplicación (400/401/500)", async () => {
    for (const status of [400, 401, 500]) {
      const { fetchImpl, calls } = responder([status, 200]);
      const res = await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0 });
      expect(res.status).toBe(status);
      expect(calls).toHaveLength(1);
    }
  });

  it("devuelve el último 502 si se agotan los reintentos", async () => {
    const { fetchImpl, calls } = responder([502]);
    const res = await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0, retries: 2 });
    expect(res.status).toBe(502);
    expect(calls).toHaveLength(3);
  });

  it("reintenta errores de red y lanza si nunca conecta", async () => {
    const { fetchImpl, calls } = responder(["network"]);
    await expect(fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0, retries: 1 })).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });

  // ── POST/PATCH: sin Idempotency-Key en el backend, nada de duplicados ─

  it("POST y PATCH no reintentan 504 (el backend pudo procesar la request)", async () => {
    for (const method of ["POST", "PATCH"]) {
      const { fetchImpl, calls } = responder([504, 201]);
      const res = await fetchBackend("http://b/x", { method, body: "{}" }, { fetchImpl, delayMs: 0 });
      expect(res.status).toBe(504);
      expect(calls).toHaveLength(1);
    }
  });

  it("POST reintenta 502 y 503 (la request no llegó al contenedor)", async () => {
    const { fetchImpl, calls } = responder([502, 503, 201]);
    const res = await fetchBackend("http://b/x", { method: "POST", body: "{}" }, { fetchImpl, delayMs: 0 });
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(3);
  });

  it("POST no reintenta errores después de conectar (conexión cortada, timeout, causa desconocida)", async () => {
    for (const kind of ["reset", "timeout", "network"]) {
      const { fetchImpl, calls } = responder([kind, 201]);
      await expect(
        fetchBackend("http://b/x", { method: "POST", body: "{}" }, { fetchImpl, delayMs: 0 })
      ).rejects.toThrow();
      expect(calls).toHaveLength(1);
    }
  });

  it("POST sí reintenta si no llegó a conectar (ECONNREFUSED)", async () => {
    const { fetchImpl, calls } = responder(["refused", 201]);
    const res = await fetchBackend("http://b/x", { method: "POST", body: "{}" }, { fetchImpl, delayMs: 0 });
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(2);
  });

  it("GET, PUT y DELETE (idempotentes) reintentan 504 y timeouts", async () => {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const { fetchImpl, calls } = responder([504, "timeout", 200]);
      const res = await fetchBackend("http://b/x", { method }, { fetchImpl, delayMs: 0 });
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(3);
    }
  });

  // ── Timeout por intento ──────────────────────────────────────────────

  it("cada intento lleva un AbortSignal propio", async () => {
    const { fetchImpl, calls } = responder([502, 200]);
    await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].init.signal).not.toBe(calls[0].init.signal);
  });

  it("el intento se aborta al vencer timeoutMs", async () => {
    const fetchImpl = (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      });
    await expect(
      fetchBackend("http://b/x", { method: "POST" }, { fetchImpl, delayMs: 0, timeoutMs: 20 })
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("respeta la señal del caller además del timeout", async () => {
    const controller = new AbortController();
    const fetchImpl = (url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
        controller.abort(new Error("cancelado por el caller"));
      });
    await expect(
      fetchBackend("http://b/x", { method: "POST", signal: controller.signal }, { fetchImpl, delayMs: 0 })
    ).rejects.toThrow("cancelado por el caller");
  });

  // ── Idempotency-Key ──────────────────────────────────────────────────

  it("inyecta Idempotency-Key idéntica en todos los reintentos para POST", async () => {
    const { fetchImpl, calls } = responder([502, 502, 200]);
    const res = await fetchBackend(
      "http://b/x",
      { method: "POST", body: "{}" },
      { fetchImpl, delayMs: 0, retries: 5 },
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(3);

    // Todos los intentos llevan la misma key
    const keys = calls.map((c) => {
      const h = c.init.headers;
      return h instanceof Headers ? h.get("Idempotency-Key") : h["Idempotency-Key"];
    });
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe(keys[0]);
  });

  it("no inyecta Idempotency-Key para GET", async () => {
    const { fetchImpl, calls } = responder([502, 200]);
    await fetchBackend("http://b/x", {}, { fetchImpl, delayMs: 0, retries: 5 });
    expect(calls).toHaveLength(2);

    for (const c of calls) {
      const h = c.init.headers;
      const key = h instanceof Headers ? h.get("Idempotency-Key") : h?.["Idempotency-Key"];
      expect(key).toBeFalsy();
    }
  });

  it("respeta Idempotency-Key provista por el caller", async () => {
    const customKey = "my-custom-key-123";
    const { fetchImpl, calls } = responder([502, 200]);
    await fetchBackend(
      "http://b/x",
      { method: "POST", headers: { "Idempotency-Key": customKey } },
      { fetchImpl, delayMs: 0, retries: 5 },
    );
    expect(calls).toHaveLength(2);

    for (const c of calls) {
      const h = c.init.headers;
      const key = h instanceof Headers ? h.get("Idempotency-Key") : h["Idempotency-Key"];
      expect(key).toBe(customKey);
    }
  });

  it("inyecta Idempotency-Key también para PATCH y PUT", async () => {
    for (const method of ["PATCH", "PUT"]) {
      const { fetchImpl, calls } = responder([200]);
      await fetchBackend(
        "http://b/x",
        { method },
        { fetchImpl, delayMs: 0 },
      );
      expect(calls).toHaveLength(1);
      const h = calls[0].init.headers;
      const key = h instanceof Headers ? h.get("Idempotency-Key") : h["Idempotency-Key"];
      expect(key).toBeTruthy();
    }
  });

  describe("política de retry y helpers", () => {
    it("identifica estados reintentables (502, 503, 504) y no reintentables (400, 401, 500)", () => {
      expect(isRetryableStatus(502)).toBe(true);
      expect(isRetryableStatus(503)).toBe(true);
      expect(isRetryableStatus(504)).toBe(true);

      expect(isRetryableStatus(200)).toBe(false);
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(500)).toBe(false);
    });

    it("para POST y PATCH solo 502 y 503 son reintentables", () => {
      expect(isRetryableStatus(502, "post")).toBe(true);
      expect(isRetryableStatus(503, "PATCH")).toBe(true);
      expect(isRetryableStatus(504, "POST")).toBe(false);
      expect(isRetryableStatus(504, "PUT")).toBe(true);
    });

    it("distingue errores de conexión (antes de mandar la request) del resto", () => {
      expect(isConnectError(fetchFailed("ECONNREFUSED"))).toBe(true);
      expect(isConnectError(fetchFailed("ENOTFOUND"))).toBe(true);
      expect(isConnectError(fetchFailed("UND_ERR_CONNECT_TIMEOUT"))).toBe(true);
      expect(isConnectError(fetchFailed("UND_ERR_SOCKET"))).toBe(false);
      expect(isConnectError(fetchFailed())).toBe(false);
      expect(isConnectError(undefined)).toBe(false);

      expect(isRetryableError(fetchFailed("UND_ERR_SOCKET"), "GET")).toBe(true);
      expect(isRetryableError(fetchFailed("UND_ERR_SOCKET"), "POST")).toBe(false);
      expect(isRetryableError(fetchFailed("ECONNREFUSED"), "POST")).toBe(true);
    });

    it("genera UUID v4 válido como Idempotency-Key", () => {
      const key = generateIdempotencyKey();
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
