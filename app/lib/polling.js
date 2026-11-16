/**
 * Polling de las vistas que se refrescan solas: las del dispatcher
 * (/ops/lista, /ops/mapa y el tablero por estados de /ops), la lista y el
 * detalle de alertas del ciudadano (/mis-alertas y /mis-alertas/[id]) y la
 * del oficial (/oficial). Igual que sosController.js, no usa React: recibe la
 * función de carga y el `document` por parámetro, así se testea con timers
 * falsos sin renderizar componentes.
 *
 * - Nunca hay dos pedidos en vuelo: el próximo se agenda recién cuando
 *   termina el anterior (setTimeout encadenado, no setInterval). Con el
 *   backend dormido el BFF tarda hasta ~24 s en contestar, más que el
 *   intervalo, y con setInterval los pedidos se apilaban.
 * - Con la pestaña oculta no se agenda nada; al volver carga en el acto.
 * - refresh() pide datos frescos ya (p. ej. después de validar). Si hay un
 *   pedido en vuelo espera a que termine y vuelve a pedir, porque esa
 *   respuesta puede haberse armado antes de la acción.
 *
 * `load` maneja (y muestra) sus propios errores: el poller los ignora para
 * que un error no corte el ciclo.
 *
 * @param {object} deps
 * @param {() => Promise<any>} deps.load
 * @param {number} deps.intervalMs
 * @param {Document} [deps.doc] Default: el `document` global, si existe.
 * @param {typeof setTimeout} [deps.setTimeoutFn]
 * @param {typeof clearTimeout} [deps.clearTimeoutFn]
 */
export function createPoller({
  load,
  intervalMs,
  doc = typeof document === "undefined" ? undefined : document,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let running = false;
  let timerId = null;
  let inFlight = null;
  let queued = null;

  function isVisible() {
    return doc?.visibilityState !== "hidden";
  }

  function clearTimer() {
    if (timerId !== null) {
      clearTimeoutFn(timerId);
      timerId = null;
    }
  }

  function schedule() {
    clearTimer();
    if (running && isVisible()) {
      timerId = setTimeoutFn(run, intervalMs);
    }
  }

  function run() {
    clearTimer();
    inFlight = Promise.resolve()
      .then(load)
      .catch(() => {})
      .finally(() => {
        inFlight = null;
        schedule();
      });
    return inFlight;
  }

  function refresh() {
    if (!inFlight) return run();
    if (!queued) {
      queued = inFlight.then(() => {
        queued = null;
        return running ? run() : undefined;
      });
    }
    return queued;
  }

  function handleVisibilityChange() {
    if (isVisible()) refresh();
    else clearTimer();
  }

  return {
    /** Primera carga y arranque del ciclo (aunque la pestaña esté oculta,
     * para que al volver ya haya datos). */
    start() {
      if (running) return;
      running = true;
      doc?.addEventListener("visibilitychange", handleVisibilityChange);
      refresh();
    },
    stop() {
      running = false;
      clearTimer();
      doc?.removeEventListener("visibilitychange", handleVisibilityChange);
    },
    refresh,
  };
}

/**
 * Merge de un poll del tablero: la lista nueva reemplaza entera a la
 * anterior (así los cambios de estado, prioridad u oficial se ven) y los
 * "nuevos" salen por diferencia de IDs contra el poll anterior.
 *
 * @param {Array|null} previous Lista del poll anterior; null en la primera
 *   carga, que no marca nada como nuevo.
 * @param {Array} incoming Lista recién recibida.
 * @returns {{ emergencies: Array, newIds: string[] }}
 */
export function mergeEmergencyPoll(previous, incoming) {
  const emergencies = Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(previous)) return { emergencies, newIds: [] };
  const knownIds = new Set(previous.map((em) => String(em.id)));
  const newIds = emergencies
    .map((em) => String(em.id))
    .filter((id) => !knownIds.has(id));
  return { emergencies, newIds };
}
