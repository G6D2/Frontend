import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { fetchBackend } from "@/lib/backend-fetch";

/**
 * POST /api/auth/register → POST {BACKEND}/auth/register
 * Setea cookie httpOnly con el JWT local.
 */
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
    res = await fetchBackend(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        preferred_username: body.preferred_username,
      }),
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
        error: data?.error || "Register failed",
        message: data?.message || `Error HTTP ${res.status}`,
      },
      { status: res.status }
    );
  }

  const accessToken = data?.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Register failed", message: "El backend no devolvió access_token" },
      { status: 502 }
    );
  }

  const user = data.user || userFromJwt(accessToken);
  const response = NextResponse.json({
    success: true,
    user,
    expires_in: data.expires_in,
  });
  response.cookies.set(SESSION_COOKIE, accessToken, sessionCookieOptions(accessToken));
  return response;
}
