// Unit: middleware.js (guard de sesión y de rol de Next).
//
// Se invoca `middleware(request)` directo con un NextRequest real y se mira la
// respuesta: 401 JSON, redirect (307 + Location) o "seguir" (header
// x-middleware-next). El middleware no valida la firma del JWT (eso lo hace el
// backend); solo mira que la cookie exista, que `exp` no esté vencido y los
// `groups` del payload.
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "../middleware.js";

const BASE = "http://localhost";
const COOKIE = "citypass_session";

function jwtFor(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
const anHourAgo = () => Math.floor(Date.now() / 1000) - 3600;

const tokens = {
  citizen: () => jwtFor({ sub: "CIT-JuanPanico", groups: ["citizen"], exp: inOneHour() }),
  dispatcher: () => jwtFor({ sub: "DISP-Demo001", groups: ["dispatcher"], exp: inOneHour() }),
  officer: () => jwtFor({ sub: "of-001", groups: ["officer"], exp: inOneHour() }),
  noGroups: () => jwtFor({ sub: "U1", exp: inOneHour() }),
  expired: () => jwtFor({ sub: "CIT-JuanPanico", groups: ["citizen"], exp: anHourAgo() }),
};

function run(path, token) {
  const headers = token ? { cookie: `${COOKIE}=${token}` } : {};
  return middleware(new NextRequest(`${BASE}${path}`, { headers }));
}

function expectNext(res) {
  expect(res.headers.get("x-middleware-next")).toBe("1");
  expect(res.headers.get("location")).toBeNull();
}

function expectRedirect(res, path) {
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe(`${BASE}${path}`);
}

function expectCookieCleared(res) {
  const cookie = res.cookies.get(COOKIE);
  expect(cookie).toMatchObject({ value: "", maxAge: 0, httpOnly: true, path: "/" });
}

function expectCookieUntouched(res) {
  expect(res.cookies.get(COOKIE)).toBeUndefined();
}

describe("middleware: /api/backend y /api/auth/session", () => {
  it("sin cookie: 401 JSON y no toca cookies", async () => {
    const res = run("/api/backend/api/emergencies");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized", message: "Sin sesión" });
    expectCookieUntouched(res);
  });

  it("cookie vencida: 401 y borra la cookie", () => {
    const res = run("/api/backend/api/emergencies", tokens.expired());
    expect(res.status).toBe(401);
    expectCookieCleared(res);
  });

  it("cookie que no es un JWT: se trata como vencida (401 y se borra)", () => {
    const res = run("/api/backend/api/emergencies", "no-es-un-jwt");
    expect(res.status).toBe(401);
    expectCookieCleared(res);
  });

  it("sesión válida: deja pasar al proxy, sin mirar el rol", () => {
    expectNext(run("/api/backend/api/emergencies", tokens.citizen()));
    expectNext(run("/api/backend/api/officers", tokens.officer()));
  });

  it("/api/auth/session usa la misma regla", () => {
    expect(run("/api/auth/session").status).toBe(401);
    expectNext(run("/api/auth/session", tokens.dispatcher()));
  });
});

describe("middleware: /acceso", () => {
  it("sin sesión: muestra el login", () => {
    expectNext(run("/acceso"));
  });

  it("con sesión vencida: muestra el login (no redirige)", () => {
    expectNext(run("/acceso", tokens.expired()));
  });

  it("con sesión de citizen: redirige a /inicio", () => {
    expectRedirect(run("/acceso", tokens.citizen()), "/inicio");
  });

  it("con sesión de dispatcher: redirige a /ops", () => {
    expectRedirect(run("/acceso", tokens.dispatcher()), "/ops");
  });

  it("con sesión de officer: redirige a /oficial", () => {
    expectRedirect(run("/acceso", tokens.officer()), "/oficial");
  });
});

describe("middleware: rutas protegidas sin sesión", () => {
  it.each(["/inicio", "/reportar", "/mis-alertas/abc", "/perfil/datos", "/ops", "/ops/lista"])(
    "%s sin cookie: redirige a /acceso",
    (path) => {
      const res = run(path);
      expectRedirect(res, "/acceso");
      expectCookieUntouched(res);
    }
  );

  it("con cookie vencida: redirige a /acceso y borra la cookie", () => {
    const res = run("/ops/lista", tokens.expired());
    expectRedirect(res, "/acceso");
    expectCookieCleared(res);
  });
});

describe("middleware: guard de rol", () => {
  it.each(["/ops", "/ops/lista", "/ops/asignar/abc"])(
    "citizen en %s: redirige a /inicio",
    (path) => {
      expectRedirect(run(path, tokens.citizen()), "/inicio");
    }
  );

  it.each(["/inicio", "/reportar", "/mis-alertas", "/mis-alertas/abc", "/perfil", "/perfil/ubicaciones"])(
    "dispatcher en %s: redirige a /ops",
    (path) => {
      expectRedirect(run(path, tokens.dispatcher()), "/ops");
    }
  );

  it("officer en /ops: redirige a /oficial (solo dispatcher entra a /ops)", () => {
    expectRedirect(run("/ops/lista", tokens.officer()), "/oficial");
  });

  it("officer en pantallas de ciudadano: redirige a /oficial (le darían 403)", () => {
    expectRedirect(run("/inicio", tokens.officer()), "/oficial");
    expectRedirect(run("/mis-alertas/abc", tokens.officer()), "/oficial");
  });

  it("officer en /oficial: pasa", () => {
    expectNext(run("/oficial", tokens.officer()));
  });

  it("/oficial sin sesión redirige a /acceso; con otro rol, a su home", () => {
    expectRedirect(run("/oficial"), "/acceso");
    expectRedirect(run("/oficial", tokens.citizen()), "/inicio");
    expectRedirect(run("/oficial", tokens.dispatcher()), "/ops");
  });

  it("token sin groups: se trata como no-dispatcher", () => {
    expectRedirect(run("/ops", tokens.noGroups()), "/inicio");
    expectNext(run("/inicio", tokens.noGroups()));
  });

  it("cada rol pasa en sus rutas", () => {
    expectNext(run("/inicio", tokens.citizen()));
    expectNext(run("/mis-alertas/abc", tokens.citizen()));
    expectNext(run("/ops", tokens.dispatcher()));
    expectNext(run("/ops/historial", tokens.dispatcher()));
  });
});

describe("middleware: rutas públicas y no protegidas", () => {
  it.each(["/", "/api/auth/login", "/api/auth/logout", "/api/auth/register", "/api/warmup"])(
    "%s sin sesión: pasa",
    (path) => {
      expectNext(run(path));
    }
  );

  // Hoy el middleware no corta /api/geocode: el comentario del route dice que
  // requiere sesión, pero ni el middleware ni el route lo chequean.
  it("/api/geocode sin sesión: pasa", () => {
    expectNext(run("/api/geocode?lat=-34.6&lng=-58.4"));
  });

  it("los prefijos matchean por segmento: /opsx o /inicio-demo no son rutas protegidas", () => {
    expectNext(run("/opsx"));
    expectNext(run("/inicio-demo", tokens.dispatcher()));
  });
});

describe("middleware: config.matcher", () => {
  // Next compila el matcher con path-to-regexp; para este patrón (un solo
  // grupo con lookahead) alcanza con anclarlo como RegExp.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("corre en páginas y en el BFF", () => {
    for (const path of ["/", "/acceso", "/ops/lista", "/api/backend/api/emergencies"]) {
      expect(matcher.test(path)).toBe(true);
    }
  });

  it("no corre en assets estáticos ni imágenes", () => {
    for (const path of ["/_next/static/chunks/main.js", "/_next/image", "/icon.png", "/Images/logo.svg"]) {
      expect(matcher.test(path)).toBe(false);
    }
  });
});
