import { NextResponse } from "next/server";
import { BACKEND_URL, readAccessToken, SESSION_COOKIE } from "@/lib/session";
import { fetchBackend } from "@/lib/backend-fetch";

async function proxy(request, context) {
  const { path = [] } = await context.params;
  const targetPath = Array.isArray(path) ? path.join("/") : path;
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

  const init = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let backendRes;
  try {
    // Reintenta 502/503/504 y errores de red: el backend dormido de Render
    // nunca llegó a procesar la request, así que es seguro incluso para POST.
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
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
