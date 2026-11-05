import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { ANTIPANIC_MODE } from "@/app/lib/features";
import { fetchBackend } from "@/lib/backend-fetch";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/auth/login
 *
 * - email+password → POST /auth/login (usuarios reales)
 * - sub (+ groups) → POST /auth/dev/login (atajos demo / anónimo / dispatcher)
 *
 * Solo acepta JSON del mismo origen (ver lib/csrf.js): sin eso, otro sitio
 * podía loguear a la víctima con una cuenta ajena.
 */
export async function POST(request) {
  const rejected = checkCsrf(request);
  if (rejected) return rejected;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "JSON inválido" },
      { status: 400 }
    );
  }

  const isCredentialLogin =
    typeof body.email === "string" && typeof body.password === "string";
  const backendPath = isCredentialLogin ? "/auth/login" : "/auth/dev/login";
  const backendBody = isCredentialLogin
    ? { email: body.email, password: body.password }
    : {
        sub: body.sub,
        preferred_username: body.preferred_username,
        groups: body.groups,
      };

  let res;
  try {
    res = await fetchBackend(`${BACKEND_URL}${backendPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(backendBody),
    });
  } catch {
    return NextResponse.json(
      {
        error: "Bad Gateway",
        message: "El backend no responde. Probá de nuevo en unos segundos.",
      },
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

  let user = data.user || userFromJwt(accessToken);
  try {
    const meRes = await fetchBackend(`${BACKEND_URL}/api/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      user = { ...user, ...(me.data || {}) };
    }
  } catch {
    // keep token-derived user
  }

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
