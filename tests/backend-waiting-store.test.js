import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// El store "esperando al backend" vive en app/lib/api.js (ver ítem 8 del
// fix de ciudadano): apiFetch marca backendWaitingStore como esperando recién
// si una llamada supera 3 s sin resolverse, y lo limpia apenas responde.

describe("backendWaitingStore", () => {
  let fetchEmergencies;
  let backendWaitingStore;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const api = await import("../app/lib/api.js");
    fetchEmergencies = api.fetchEmergencies;
    backendWaitingStore = api.backendWaitingStore;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubPendingFetch() {
    let resolveFetch;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending)
    );
    return (data = { data: [] }) =>
      resolveFetch({
        ok: true,
        status: 200,
        json: async () => data,
      });
  }

  it("no está esperando antes de hacer ninguna llamada", () => {
    expect(backendWaitingStore.getSnapshot()).toBe(false);
  });

  it("no marca esperando si la respuesta llega antes de los 3s", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      }))
    );

    await fetchEmergencies();

    expect(backendWaitingStore.getSnapshot()).toBe(false);
  });

  it("marca esperando recién después de 3s sin respuesta, y lo limpia al resolver", async () => {
    const resolveWith = stubPendingFetch();

    const callPromise = fetchEmergencies();

    await vi.advanceTimersByTimeAsync(2999);
    expect(backendWaitingStore.getSnapshot()).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    expect(backendWaitingStore.getSnapshot()).toBe(true);

    resolveWith();
    await callPromise;

    expect(backendWaitingStore.getSnapshot()).toBe(false);
  });

  it("notifica a los listeners suscriptos cuando cambia el estado", async () => {
    const resolveWith = stubPendingFetch();
    const listener = vi.fn();
    const unsubscribe = backendWaitingStore.subscribe(listener);

    const callPromise = fetchEmergencies();
    await vi.advanceTimersByTimeAsync(3000);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    resolveWith();
    await callPromise;
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it("getServerSnapshot siempre devuelve false (sin llamadas del lado del servidor)", () => {
    expect(backendWaitingStore.getServerSnapshot()).toBe(false);
  });
});
