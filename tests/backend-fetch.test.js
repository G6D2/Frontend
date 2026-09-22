import {
  fetchBackend,
  isRetryableStatus,
  isMutatingMethod,
  generateIdempotencyKey,
  RETRYABLE_STATUS,
  MUTATING_METHODS,
  SAFE_METHODS,
} from "../lib/backend-fetch.js";

function responder(statuses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (status === "network") throw new TypeError("fetch failed");
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

    it("distingue métodos mutantes de métodos de consulta/seguros", () => {
      expect(isMutatingMethod("POST")).toBe(true);
      expect(isMutatingMethod("PUT")).toBe(true);
      expect(isMutatingMethod("PATCH")).toBe(true);

      expect(isMutatingMethod("GET")).toBe(false);
      expect(isMutatingMethod("HEAD")).toBe(false);
      expect(isMutatingMethod("OPTIONS")).toBe(false);
    });

    it("genera UUID v4 válido como Idempotency-Key", () => {
      const key = generateIdempotencyKey();
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
