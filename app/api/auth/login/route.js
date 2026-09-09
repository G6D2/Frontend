import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { ANTIPANIC_MODE } from "@/app/lib/features";
import { fetchBackend } from "@/lib/backend-fetch";

// TODO(back): reemplazar body por login IdP real cuando AUTH_MODE=idp (HU-12)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "JSON inválido" },
      { status: 400 }
    );
  }

  let res;
  try {
    // Reintenta mientras el backend despierta (Render free devuelve 502 al instante).
    res = await fetchBackend(`${BACKEND_URL}/auth/dev/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { error: "Bad Gateway", message: "El backend no responde. Probá de nuevo en unos segundos." },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      {
        error: data?.error || "Login failed",
        message: data?.message || `Error HTTP ${res.status}`,
      },
      { status: res.status }
    );
  }

  const accessToken = data?.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Login failed", message: "El backend no devolvió access_token" },
      { status: 502 }
    );
  }

  let user = userFromJwt(accessToken);
  try {
    const meRes = await fetchBackend(`${BACKEND_URL}/api/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      user = me.data || user;
    }
  } catch {
    // keep JWT-derived user
  }

  // Propagate frontend-managed permission flags.
  // En modo "mock": hasAntipanicButton viene del toggle del formulario de login (body).
  // En modo "backend": el campo ya viene incluido en me.data desde GET /api/user (no se toca).
  // ▶ Cambiar ANTIPANIC_MODE en app/lib/features.js para conectar con el backend real.
  if (ANTIPANIC_MODE === "mock" && typeof body.hasAntipanicButton === "boolean") {
    user = { ...user, hasAntipanicButton: body.hasAntipanicButton };
  }

  const response = NextResponse.json({
    success: true,
    user,
    expires_in: data.expires_in,
  });
  response.cookies.set(SESSION_COOKIE, accessToken, sessionCookieOptions(accessToken));
  return response;
}
