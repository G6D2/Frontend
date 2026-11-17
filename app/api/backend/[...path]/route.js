import { NextResponse } from "next/server";
import { BACKEND_URL, readAccessToken, SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { fetchBackend } from "@/lib/backend-fetch";
import { checkCsrf } from "@/lib/csrf";

/**
 * Rutas del backend que el front usa de verdad (app/lib/api.js y
 * app/lib/citizen-profile-api.js), con sus métodos. Todo lo demás
 * (/auth/dev/login, /api/outbox-events, /api-docs, ...) no pasa por el proxy.
 * /api/user lo consultan login y session directo contra el backend, y
 * /api/incidents no lo usa ninguna pantalla: si alguna los necesita, se suman acá.
 */
const ALLOWED_ROUTES = [
  { prefix: "api/emergencies", methods: ["GET", "PATCH"] },
  { prefix: "api/panic-button", methods: ["POST"] },
  { prefix: "api/officers", methods: ["GET"] },
  // Banner de alertas climáticas del tablero (AlertaClimaticaBanner).
  { prefix: "api/contextos-zona", methods: ["GET"] },
  { prefix: "api/citizen/profile", methods: ["GET", "PUT"] },
  { prefix: "api/citizen/saved-locations", methods: ["GET", "POST", "PATCH", "DELETE"] },
];

/**
 * Solo caracteres no reservados de URL y sin punto inicial: descarta "." y
 * "..", y cualquier resto de encoding ("%2e", "%2F") o separador que haya
 * quedado en un segmento ya decodificado ("../", "a\\b").
 */
const SAFE_SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

function findRoute(targetPath) {
  return ALLOWED_ROUTES.find(
    ({ prefix }) => targetPath === prefix || targetPath.startsWith(`${prefix}/`)
  );
}

async function proxy(request, context) {
  const { path = [] } = await context.params;
  const segments = Array.isArray(path) ? path : [path];
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    return NextResponse.json(
      { error: "Bad Request", message: "Ruta inválida" },
      { status: 400 }
    );
  }

  const targetPath = segments.join("/");
  const route = findRoute(targetPath);
  if (!route) {
    return NextResponse.json(
      { error: "Not Found", message: "Ruta no disponible" },
      { status: 404 }
    );
  }
  if (!route.methods.includes(request.method)) {
    return NextResponse.json(
      { error: "Method Not Allowed", message: `${request.method} no permitido en esta ruta` },
      { status: 405, headers: { Allow: route.methods.join(", ") } }
    );
  }

  if (request.method !== "GET") {
    // DELETE viaja sin body: solo se exige mismo origen.
    const rejected = checkCsrf(request, { json: request.method !== "DELETE" });
    if (rejected) return rejected;
  }

  const url = new URL(request.url);
  const target = `${BACKEND_URL}/${targetPath}${url.search}`;

  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sesión expirada. Volvé a iniciar sesión." },
      { status: 401 }
    );
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  const init = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET") {
    init.body = await request.text();
  }

  let backendRes;
  try {
    // Reintenta el cold start de Render. POST y PATCH solo ante 502/503 o si
    // no llegó a conectar: el backend no implementa Idempotency-Key, así que
    // reintentar un 504 podía duplicar el alta (ver lib/backend-fetch.js).
    backendRes = await fetchBackend(target, init);
  } catch {
    return NextResponse.json(
      { error: "Bad Gateway", message: "El backend no responde. Probá de nuevo en unos segundos." },
      { status: 502 }
    );
  }

  const text = await backendRes.text();
  const response = new NextResponse(text, {
    status: backendRes.status,
    headers: {
      "Content-Type":
        backendRes.headers.get("content-type") || "application/json",
    },
  });

  if (backendRes.status === 401) {
    const clearOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };
    response.cookies.set(SESSION_COOKIE, "", clearOpts);
  }

  return response;
}

// PUT y DELETE los usan perfil y ubicaciones guardadas (ALLOWED_ROUTES
// restringe qué método va a qué ruta).
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
