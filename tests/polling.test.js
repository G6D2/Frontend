import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPoller, mergeEmergencyPoll } from "../app/lib/polling";

const INTERVAL = 15_000;

/** `document` mínimo: visibilityState + listeners de visibilitychange. */
function createFakeDocument(visibilityState = "visible") {
  const listeners = new Set();
  return {
    visibilityState,
    addEventListener: vi.fn((type, fn) => {
      if (type === "visibilitychange") listeners.add(fn);
    }),
    removeEventListener: vi.fn((type, fn) => {
      if (type === "visibilitychange") listeners.delete(fn);
    }),
    setVisibility(state) {
      this.visibilityState = state;
      listeners.forEach((fn) => fn());
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

/** load() que queda colgado hasta que el test lo resuelve. */
function createDeferredLoad() {
  const resolvers = [];
  const load = vi.fn(
    () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      })
  );
  return {
    load,
    resolveNext() {
      resolvers.shift()?.();
    },
  };
}

describe("createPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("carga al arrancar y después cada intervalo", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller({ load, intervalMs: INTERVAL, doc: createFakeDocument() });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(load).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("no superpone pedidos: el próximo se agenda cuando termina el anterior", async () => {
    const { load, resolveNext } = createDeferredLoad();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc: createFakeDocument() });

    poller.start();
    // El backend dormido tarda más que varios intervalos en contestar.
    await vi.advanceTimersByTimeAsync(INTERVAL * 4);
    expect(load).toHaveBeenCalledTimes(1);

    resolveNext();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(load).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("start() dos veces no duplica el ciclo", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const doc = createFakeDocument();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(doc.listenerCount()).toBe(1);

    poller.stop();
  });

  it("con la pestaña oculta hace la primera carga pero no agenda más", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const doc = createFakeDocument("hidden");
    const poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it("se pausa al ocultar la pestaña y al volver carga en el acto", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const doc = createFakeDocument();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);

    doc.setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);

    doc.setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(load).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("si se oculta con un pedido en vuelo, al terminar no agenda el siguiente", async () => {
    const { load, resolveNext } = createDeferredLoad();
    const doc = createFakeDocument();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    doc.setVisibility("hidden");
    resolveNext();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it("refresh() sin pedido en vuelo carga ya y reinicia el intervalo", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller({ load, intervalMs: INTERVAL, doc: createFakeDocument() });

    poller.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(1);

    await poller.refresh();
    expect(load).toHaveBeenCalledTimes(2);

    // El timer viejo (que vencía a los 15 s del arranque) ya no corre.
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(3);

    poller.stop();
  });

  it("refresh() con un pedido en vuelo espera y vuelve a pedir una sola vez", async () => {
    const { load, resolveNext } = createDeferredLoad();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc: createFakeDocument() });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);

    const first = poller.refresh();
    const second = poller.refresh();
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);

    resolveNext();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);

    let settled = false;
    first.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    resolveNext();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);

    poller.stop();
  });

  it("sigue el ciclo aunque load() falle", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("Error HTTP 502"))
      .mockResolvedValue(undefined);
    const poller = createPoller({ load, intervalMs: INTERVAL, doc: createFakeDocument() });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(load).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("stop() corta el ciclo, saca el listener y no ejecuta un refresh encolado", async () => {
    const { load, resolveNext } = createDeferredLoad();
    const doc = createFakeDocument();
    const poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    poller.refresh();
    poller.stop();
    expect(doc.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    expect(doc.listenerCount()).toBe(0);

    resolveNext();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);
  });

  // Lo usa el detalle de /mis-alertas/[id]: deja de consultar cuando la
  // emergencia llega a un estado terminal.
  it("stop() llamado desde load() no agenda el siguiente ni vuelve con la pestaña", async () => {
    const doc = createFakeDocument();
    let poller = null;
    const load = vi.fn(async () => {
      poller.stop();
    });
    poller = createPoller({ load, intervalMs: INTERVAL, doc });

    poller.start();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);
    expect(doc.listenerCount()).toBe(0);

    doc.setVisibility("hidden");
    doc.setVisibility("visible");
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("sin document (SSR/tests) se comporta como pestaña visible", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const poller = createPoller({ load, intervalMs: INTERVAL });

    poller.start();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(load).toHaveBeenCalledTimes(2);

    poller.stop();
  });
});

describe("mergeEmergencyPoll", () => {
  it("en la primera carga reemplaza la lista y no marca nada como nuevo", () => {
    const incoming = [{ id: "a", status: "PENDING" }];
    expect(mergeEmergencyPoll(null, incoming)).toEqual({
      emergencies: incoming,
      newIds: [],
    });
  });

  it("reemplaza la lista entera: los cambios de estado se ven", () => {
    const previous = [
      { id: "a", status: "PENDING" },
      { id: "b", status: "VALIDATED" },
    ];
    const incoming = [
      { id: "a", status: "VALIDATED" },
      { id: "b", status: "DISPATCHED" },
    ];

    const { emergencies, newIds } = mergeEmergencyPoll(previous, incoming);
    expect(emergencies).toBe(incoming);
    expect(emergencies.map((em) => em.status)).toEqual(["VALIDATED", "DISPATCHED"]);
    expect(newIds).toEqual([]);
  });

  it("los nuevos salen por diferencia de IDs y las que se fueron desaparecen", () => {
    const previous = [{ id: "a" }, { id: "b" }];
    const incoming = [{ id: "c" }, { id: "a" }, { id: "d" }];

    const { emergencies, newIds } = mergeEmergencyPoll(previous, incoming);
    expect(emergencies.map((em) => em.id)).toEqual(["c", "a", "d"]);
    expect(newIds).toEqual(["c", "d"]);
  });

  it("compara IDs como string (número y string son la misma emergencia)", () => {
    const { newIds } = mergeEmergencyPoll([{ id: 7 }], [{ id: "7" }, { id: 8 }]);
    expect(newIds).toEqual(["8"]);
  });

  it("si la respuesta no es un array devuelve lista vacía", () => {
    expect(mergeEmergencyPoll([{ id: "a" }], null)).toEqual({
      emergencies: [],
      newIds: [],
    });
  });
});
