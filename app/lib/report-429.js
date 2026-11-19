/**
 * 429 que ve el navegador y que el servidor nunca vio.
 *
 * El servidor (BFF) registra todo 429 que pasa por él y lo marca con
 * `X-429-Logged: 1` (lib/log-429.js). Un 429 sin esa marca en una respuesta de
 * nuestro propio origen lo cortó algo ANTES de llegar al servidor: típicamente
 * Cloudflare delante de frontend-krds.onrender.com. Esos no dejan rastro en
 * ningún log, así que el navegador los anota en una cola (localStorage) y los
 * manda a POST /api/telemetry/429 cuando un pedido vuelve a pasar.
 *
 * Sin React ni DOM más allá de lo que se le pasa: se prueba con dobles.
 * Límite conocido: una carga de página entera bloqueada no corre JavaScript,
 * así que no se puede anotar.
 */
export const QUEUE_KEY = "citypass_429_queue";
export const TELEMETRY_PATH = "/api/telemetry/429";
export const LOGGED_HEADER = "x-429-logged";
export const MAX_QUEUE = 50;
export const MAX_BATCH = 20;

function storage(win) {
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readQueue(win) {
  try {
    const raw = storage(win)?.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(win, events) {
  try {
    const store = storage(win);
    if (!store) return;
    if (events.length === 0) store.removeItem(QUEUE_KEY);
    else store.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
  } catch {
    // Sin storage (modo privado, cuota): se pierde el evento, nunca rompe la app.
  }
}

/** Path de nuestro origen, o null si el pedido va a otro sitio. */
export function sameOriginPath(input, origin) {
  try {
    const raw = typeof input === "string" ? input : input?.url;
    if (!raw) return null;
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname : null;
  } catch {
    return null;
  }
}

/** ¿Es un 429 de nuestro origen que el servidor no registró? */
export function isUnlogged429(res, path) {
  return (
    res?.status === 429 &&
    path !== null &&
    path !== TELEMETRY_PATH &&
    !res.headers?.get?.(LOGGED_HEADER)
  );
}

export async function describe429(res, { path, method, page, now = () => new Date() }) {
  const h = (name) => res.headers?.get?.(name) || null;
  let body = "";
  try {
    body = (await res.clone().text()).slice(0, 300);
  } catch {
    // cuerpo ilegible: se manda sin él
  }
  return {
    at: now().toISOString(),
    method: (method || "GET").toUpperCase(),
    path,
    page: page || null,
    status: res.status,
    cfRay: h("cf-ray"),
    cfMitigated: h("cf-mitigated"),
    server: h("server"),
    contentType: h("content-type"),
    retryAfter: h("retry-after"),
    body,
  };
}

export function enqueue(win, event) {
  writeQueue(win, [...readQueue(win), event]);
}

/**
 * Manda la cola. Si el envío falla (incluso con otro 429), la cola queda para
 * el próximo intento. Devuelve cuántos eventos se mandaron.
 */
export async function flush(win, fetchImpl) {
  const queue = readQueue(win);
  if (queue.length === 0) return 0;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const res = await fetchImpl(TELEMETRY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!res?.ok) return 0;
  } catch {
    return 0;
  }
  writeQueue(win, readQueue(win).slice(batch.length));
  return batch.length;
}

/**
 * Envuelve `win.fetch`: anota los 429 sin marca y, cuando un pedido de nuestro
 * origen vuelve a salir bien, manda lo pendiente. Idempotente. Devuelve la
 * función que deshace el envoltorio.
 */
export function installFetchWatcher(win) {
  if (!win?.fetch || win.fetch.__report429) return () => {};
  const original = win.fetch.bind(win);
  const origin = win.location?.origin;
  let flushing = false;

  const flushSoon = () => {
    if (flushing || readQueue(win).length === 0) return;
    flushing = true;
    flush(win, original).finally(() => {
      flushing = false;
    });
  };

  const watched = async (input, init) => {
    const res = await original(input, init);
    const path = sameOriginPath(input, origin);
    try {
      if (isUnlogged429(res, path)) {
        const method = init?.method || (typeof input === "object" ? input?.method : undefined);
        enqueue(win, await describe429(res, { path, method, page: win.location?.pathname }));
      } else if (res.ok && path !== null && path !== TELEMETRY_PATH) {
        flushSoon();
      }
    } catch {
      // el registro nunca afecta al pedido
    }
    return res;
  };
  watched.__report429 = true;
  win.fetch = watched;
  return () => {
    if (win.fetch === watched) win.fetch = original;
  };
}
