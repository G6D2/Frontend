// Integración: POST y GET /api/auth/logout (app/api/auth/logout/route.js)
//
// El logout borra las dos cookies (citypass_session y citypass_refresh)
// siempre. Si la sesión venía del Login Federado, antes revoca el refresh
// token en el IdP, con un tope de 3 s: ni un fallo ni la demora del IdP
// pueden dejar al usuario sin poder cerrar sesión. El CSRF de esta ruta está
// en csrf.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { POST, GET } from "../../app/api/auth/logout/route.js";
import {
  mockNextCookies,
  mockBackend,
  mockHangingFetch,
  fakeAbortSignalTimeout,
  makeRequest,
} from "./helpers.js";

const SAME_ORIGIN = { Host: "citypass.test", Origin: "https://citypass.test" };
const LOGOUT_URL = "https://citypass.test/api/auth/logout";

const postRequest = () => makeRequest(LOGOUT_URL, { method: "POST", headers: SAME_ORIGIN });

function expectCookiesCleared(res) {
  for (const name of ["citypass_session", "citypass_refresh"]) {
    expect(res.cookies.get(name)?.value).toBe("");
    expect(res.cookies.get(name)?.maxAge).toBe(0);
  }
}

describe("/api/auth/logout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sesión local (sin refresh token): no llama al IdP y borra las cookies", async () => {
    mockNextCookies(cookies, { citypass_session: "un-token" });
    const { calls } = mockBackend({});

    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(calls).toHaveLength(0);
    expectCookiesCleared(res);
  });

  it("sesión federada: revoca el refresh token en el IdP y borra las cookies", async () => {
    mockNextCookies(cookies, { citypass_session: "un-token", citypass_refresh: "rt-1" });
    const { calls } = mockBackend({ "POST /auth/logout": { status: 200, body: {} } });

    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body)).toEqual({ refreshToken: "rt-1" });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expectCookiesCleared(res);
  });

  it.each([
    ["sin conexión", "network-error"],
    ["5xx", { status: 503, body: {} }],
    ["rechaza el refresh token", { status: 401, body: {} }],
  ])("el IdP falla al revocar (%s): igual responde 200 y borra las cookies", async (_label, idpResponse) => {
    mockNextCookies(cookies, { citypass_session: "un-token", citypass_refresh: "rt-1" });
    mockBackend({ "POST /auth/logout": idpResponse });

    const res = await POST(postRequest());

    expect(res.status).toBe(200);
    expectCookiesCleared(res);
  });

  describe("el IdP no responde", () => {
    let timeoutSpy;

    beforeEach(() => {
      mockNextCookies(cookies, { citypass_session: "un-token", citypass_refresh: "rt-1" });
      vi.useFakeTimers();
      timeoutSpy = fakeAbortSignalTimeout();
    });

    afterEach(() => {
      timeoutSpy.mockRestore();
      vi.useRealTimers();
    });

    it("POST: corta la revocación a los 3 s y borra las cookies", async () => {
      const { calls } = mockHangingFetch();

      let settled = false;
      const pending = POST(postRequest()).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(2999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const res = await pending;

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expectCookiesCleared(res);
      expect(timeoutSpy).toHaveBeenCalledWith(3000);
      expect(calls).toHaveLength(1);
    });

    it("GET: corta la revocación a los 3 s, redirige a /acceso y borra las cookies", async () => {
      mockHangingFetch();

      const pending = GET(makeRequest(LOGOUT_URL));
      await vi.advanceTimersByTimeAsync(3000);
      const res = await pending;

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://citypass.test/acceso");
      expectCookiesCleared(res);
      expect(timeoutSpy).toHaveBeenCalledWith(3000);
    });
  });
});
