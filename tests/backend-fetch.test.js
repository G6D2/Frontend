import { describe, it, expect } from "vitest";
import { fetchBackend } from "../lib/backend-fetch.js";

function responder(statuses) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
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
});
