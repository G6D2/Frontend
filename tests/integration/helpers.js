// Helpers para tests de integración de las rutas del BFF (`app/api/**`).
//
// Los Route Handlers de Next se importan directo (`import { POST } from
// "app/api/.../route.js"`) y se invocan como funciones: reciben un `Request`
// de la Web API y devuelven un `Response`/`NextResponse`. No hay servidor HTTP
// real levantado, así que estos tests corren rápido y en el mismo proceso que
// vitest (`environment: "node"`, ver vitest.integration.config.mjs).
//
// Piezas:
//  - mockNextCookies: reemplaza `next/headers` por un jar en memoria, porque
//    `cookies()` fuera de un request real de Next explota.
//  - mockBackend: reemplaza `global.fetch` por un router de tabla que resuelve
//    por método+path (con soporte para devolver una secuencia de respuestas,
//    útil para probar los reintentos de `lib/backend-fetch.js`).
//  - mockHangingFetch + fakeAbortSignalTimeout: un servidor que no responde y
//    un `AbortSignal.timeout` que se puede adelantar con los fake timers, para
//    probar los timeouts hacia el IdP sin esperar de verdad.
//  - makeRequest: arma un `Request` de la Web API con menos boilerplate.

import { vi } from "vitest";

/**
 * Mockea `next/headers` para que `cookies()` devuelva un jar en memoria con
 * la misma forma mínima que usa el código de la app (`get`, `set`, `delete`).
 *
 * OJO: como `vi.mock` se hoistea, hay que llamar a esto ANTES de importar
 * cualquier route/helper que use `next/headers` (session.js, los route.js de
 * auth/backend). El patrón en cada test es:
 *
 *   vi.mock("next/headers", () => ({ cookies: vi.fn() }));
 *   import { cookies } from "next/headers";
 *   import { GET } from "../../app/api/auth/session/route.js";
 *   ...
 *   beforeEach(() => mockNextCookies(cookies));
 *
 * `mockNextCookies` no hace el `vi.mock` en sí (no se puede desde un helper
 * importado, por el hoisting) — solo configura el mock de `cookies` ya
 * declarado en el test para que devuelva el jar en memoria.
 */
export function mockNextCookies(cookiesMockFn, initial = {}) {
  const store = new Map(Object.entries(initial));
  const jar = {
    get: (name) => {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name, value) => {
      store.set(name, value);
    },
    delete: (name) => {
      store.delete(name);
    },
    has: (name) => store.has(name),
  };
  cookiesMockFn.mockResolvedValue(jar);
  return { jar, store };
}

function normalizePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Reemplaza `global.fetch` por un router en memoria.
 *
 * `routes` es una tabla `{ "METHOD path": respuesta | respuesta[] }`. El path
 * se matchea contra el pathname de la URL (sin query string ni host), así que
 * `${BACKEND_URL}/auth/dev/login` matchea `"POST /auth/dev/login"`.
 *
 * Cada `respuesta` puede ser:
 *  - un objeto `{ status, body }` → se envuelve como Response-like con `.json()`/`.text()`/`.ok`.
 *  - un `Response` real (o algo con `.status`/`.ok`/`.json`) → se devuelve tal cual.
 *  - la string "network-error" → simula un fallo de red (throw).
 *
 * Si el valor es un array, se consumen las respuestas en orden en llamadas
 * sucesivas (la última se repite si se llama de más) — así se simulan los
 * reintentos de `fetchBackend` (ej. [502, 502, 200]).
 *
 * Devuelve `{ calls }`, un array que registra cada invocación
 * `{ method, url, path, headers, body, signal }` para poder assertar sobre lo
 * que el BFF le mandó al backend.
 */
export function mockBackend(routes) {
  const calls = [];
  const cursors = new Map();

  function toResponseLike(entry) {
    if (entry === "network-error") {
      throw new TypeError("fetch failed");
    }
    if (entry && typeof entry.json === "function") {
      return entry;
    }
    const status = entry?.status ?? 200;
    const body = entry?.body ?? {};
    const headers = new Map(
      Object.entries(entry?.headers || { "content-type": "application/json" })
    );
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      headers: {
        get: (name) => headers.get(name.toLowerCase()) ?? headers.get(name) ?? null,
      },
    };
  }

  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = (init.method || "GET").toUpperCase();
    const path = normalizePath(url);
    const key = `${method} ${path}`;

    let headers = {};
    if (init.headers instanceof Headers) {
      headers = Object.fromEntries(init.headers.entries());
    } else if (init.headers) {
      headers = { ...init.headers };
    }

    calls.push({ method, url, path, headers, body: init.body, signal: init.signal });

    const table = routes[key];
    if (!table) {
      throw new Error(
        `mockBackend: no hay ruta configurada para "${key}". Rutas: ${Object.keys(routes).join(", ")}`
      );
    }

    if (Array.isArray(table)) {
      const idx = cursors.get(key) ?? 0;
      const entry = table[Math.min(idx, table.length - 1)];
      cursors.set(key, idx + 1);
      return toResponseLike(entry);
    }
    return toResponseLike(table);
  });

  global.fetch = fetchMock;
  return { calls, fetchMock };
}

/**
 * Reemplaza `global.fetch` por uno que no responde nunca, como un servidor
 * colgado. Igual que el fetch real, solo rechaza —con el motivo del abort— si
 * se aborta el `signal` que recibió. Si el código bajo prueba no manda
 * `signal`, el pedido queda pendiente y el test falla por timeout de vitest:
 * esa es la regresión que se quiere detectar.
 *
 * Con `{ afterHeaders: true }` responde los headers (200) y lo que queda
 * colgado es la lectura del cuerpo (`json()`/`text()`).
 *
 * Devuelve `{ calls }` con `{ method, url, path, body, signal }` por llamada.
 */
export function mockHangingFetch({ afterHeaders = false } = {}) {
  const calls = [];

  function untilAborted(signal) {
    return new Promise((_resolve, reject) => {
      if (!signal) return;
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }

  const fetchMock = vi.fn((input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({
      method: (init.method || "GET").toUpperCase(),
      url,
      path: normalizePath(url),
      body: init.body,
      signal: init.signal,
    });
    if (!afterHeaders) return untilAborted(init.signal);
    return Promise.resolve({
      status: 200,
      ok: true,
      json: () => untilAborted(init.signal),
      text: () => untilAborted(init.signal),
    });
  });

  global.fetch = fetchMock;
  return { calls, fetchMock };
}

/**
 * `AbortSignal.timeout` usa un timer interno de Node que los fake timers de
 * vitest no adelantan. Esto lo reemplaza por uno equivalente armado con
 * `setTimeout`, que aborta con el mismo `DOMException` "TimeoutError", para
 * poder adelantar el reloj con `vi.advanceTimersByTimeAsync`.
 *
 * Se usa después de `vi.useFakeTimers()`. Devuelve el spy: sirve para
 * comprobar con cuántos milisegundos se pidió el timeout y hay que restaurarlo
 * (`spy.mockRestore()`) al terminar el test.
 */
export function fakeAbortSignalTimeout() {
  return vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(
        new DOMException("The operation was aborted due to timeout", "TimeoutError")
      );
    }, ms);
    return controller.signal;
  });
}

/**
 * Construye un `Request` de la Web API para pasarle a un Route Handler.
 * `body` se serializa a JSON automáticamente si no es string.
 */
export function makeRequest(url, { method = "GET", body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!init.headers["content-type"] && !init.headers["Content-Type"]) {
      init.headers["Content-Type"] = "application/json";
    }
  }
  return new Request(url, init);
}

/** Header `Cookie: name=value` listo para pasarle a `makeRequest`. */
export function cookieHeader(name, value) {
  return { Cookie: `${name}=${value}` };
}
