import { describe, it, expect, vi, afterEach } from "vitest";
import { log429, markLogged, bodySnippet, LOGGED_HEADER } from "../lib/log-429.js";

const headersOf = (map) => ({ get: (name) => map[name] ?? null });

describe("log-429", () => {
  afterEach(() => vi.restoreAllMocks());

  it("una línea que empieza con [status][origen] y lleva lo necesario para rastrearlo", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log429({
      source: "backend",
      method: "GET",
      route: "api/emergencies",
      res: {
        status: 429,
        headers: headersOf({ "cf-ray": "r1", "retry-after": "60", server: "cloudflare", "content-type": "application/json" }),
      },
      bodyText: '{"message":"Demasiadas solicitudes."}',
      note: "prueba",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      "[429][backend] GET api/emergencies cf-ray=r1 cf-mitigated=- retry-after=60 server=cloudflare" +
        " content-type=application/json nota=\"prueba\" cuerpo=\"{'message':'Demasiadas solicitudes.'}\""
    );
  });

  it("sin respuesta: usa el status dado y guiones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log429({ source: "browser", method: "POST", route: "/x", status: 403 });
    expect(warn.mock.calls[0][0]).toMatch(/^\[403\]\[browser\] POST \/x cf-ray=- /);
  });

  it("bodySnippet saca HTML, junta espacios y recorta", () => {
    expect(bodySnippet("<html><title>Just a moment...</title>\n\n</html>")).toBe("Just a moment...");
    expect(bodySnippet("x".repeat(500))).toHaveLength(120);
    expect(bodySnippet(null)).toBe("");
  });

  it("markLogged pone X-429-Logged: 1", () => {
    const response = new Response(null, { status: 429 });
    expect(markLogged(response).headers.get(LOGGED_HEADER)).toBe("1");
  });
});
