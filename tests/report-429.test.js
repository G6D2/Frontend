import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QUEUE_KEY,
  TELEMETRY_PATH,
  MAX_QUEUE,
  MAX_BATCH,
  readQueue,
  enqueue,
  flush,
  sameOriginPath,
  isUnlogged429,
  describe429,
  installFetchWatcher,
} from "../app/lib/report-429.js";

const ORIGIN = "https://citypass.test";

function fakeWindow(fetchImpl) {
  const store = new Map();
  return {
    location: { origin: ORIGIN, pathname: "/ops" },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    fetch: fetchImpl,
    _store: store,
  };
}

function response(status, headers = {}, body = "") {
  return new Response(status === 204 ? null : body, { status, headers });
}

describe("report-429", () => {
  let win;
  beforeEach(() => {
    win = fakeWindow(vi.fn());
  });

  it("sameOriginPath: path propio, null para otro origen o basura", () => {
    expect(sameOriginPath("/api/backend/api/emergencies?x=1", ORIGIN)).toBe("/api/backend/api/emergencies");
    expect(sameOriginPath(new Request(`${ORIGIN}/api/warmup`), ORIGIN)).toBe("/api/warmup");
    expect(sameOriginPath("https://otro.test/x", ORIGIN)).toBeNull();
    expect(sameOriginPath(undefined, ORIGIN)).toBeNull();
  });

  it("isUnlogged429: solo 429 propios sin la marca del servidor, nunca la telemetría", () => {
    expect(isUnlogged429(response(429), "/api/x")).toBe(true);
    expect(isUnlogged429(response(429, { "X-429-Logged": "1" }), "/api/x")).toBe(false);
    expect(isUnlogged429(response(200), "/api/x")).toBe(false);
    expect(isUnlogged429(response(429), null)).toBe(false);
    expect(isUnlogged429(response(429), TELEMETRY_PATH)).toBe(false);
  });

  it("describe429 junta headers y el comienzo del cuerpo", async () => {
    const event = await describe429(
      response(429, { "cf-ray": "r9", "cf-mitigated": "challenge", "content-type": "text/html" }, "<title>Just a moment...</title>"),
      { path: "/ops", method: "get", page: "/ops", now: () => new Date("2026-11-19T22:00:00Z") }
    );
    expect(event).toMatchObject({
      at: "2026-11-19T22:00:00.000Z",
      method: "GET",
      path: "/ops",
      status: 429,
      cfRay: "r9",
      cfMitigated: "challenge",
      contentType: "text/html",
    });
    expect(event.body).toContain("Just a moment");
  });

  it("la cola tiene tope y sobrevive a un storage roto", () => {
    for (let i = 0; i < MAX_QUEUE + 5; i += 1) enqueue(win, { i });
    const queue = readQueue(win);
    expect(queue).toHaveLength(MAX_QUEUE);
    expect(queue.at(-1)).toEqual({ i: MAX_QUEUE + 4 });

    win._store.set(QUEUE_KEY, "no es json");
    expect(readQueue(win)).toEqual([]);
    const broken = { location: win.location, get localStorage() { throw new Error("blocked"); } };
    expect(readQueue(broken)).toEqual([]);
    expect(() => enqueue(broken, { a: 1 })).not.toThrow();
  });

  it("flush manda de a tandas y solo vacía lo enviado si el servidor responde bien", async () => {
    for (let i = 0; i < MAX_BATCH + 3; i += 1) enqueue(win, { i });
    const post = vi.fn(async () => response(204));
    await expect(flush(win, post)).resolves.toBe(MAX_BATCH);
    expect(post).toHaveBeenCalledWith(TELEMETRY_PATH, expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(post.mock.calls[0][1].body).events).toHaveLength(MAX_BATCH);
    expect(readQueue(win)).toHaveLength(3);

    await expect(flush(win, async () => response(429))).resolves.toBe(0);
    await expect(flush(win, async () => { throw new TypeError("offline"); })).resolves.toBe(0);
    expect(readQueue(win)).toHaveLength(3);

    await flush(win, post);
    expect(readQueue(win)).toHaveLength(0);
    await expect(flush(win, post)).resolves.toBe(0);
  });

  it("el watcher anota un 429 sin marca, ignora los marcados y los de otro origen, y manda al volver a pasar", async () => {
    const replies = [
      response(429, { "cf-ray": "r1" }, "Too Many Requests"),
      response(429, { "X-429-Logged": "1" }),
      response(429),
      response(200),
      response(204),
    ];
    const network = vi.fn(async () => replies.shift());
    win = fakeWindow(network);
    const uninstall = installFetchWatcher(win);

    const first = await win.fetch("/api/backend/api/emergencies", { method: "GET" });
    expect(first.status).toBe(429);
    await win.fetch("/api/auth/login", { method: "POST" });
    await win.fetch("https://otro.test/x");
    expect(readQueue(win)).toEqual([expect.objectContaining({ path: "/api/backend/api/emergencies", cfRay: "r1", page: "/ops" })]);

    await win.fetch("/api/warmup");
    await vi.waitFor(() => expect(readQueue(win)).toHaveLength(0));
    expect(network.mock.calls.at(-1)[0]).toBe(TELEMETRY_PATH);

    expect(installFetchWatcher(win)).toBeTypeOf("function");
    uninstall();
    expect(win.fetch).not.toHaveProperty("__report429");
  });
});
