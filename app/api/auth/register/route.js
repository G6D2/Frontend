import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { fetchBackend } from "@/lib/backend-fetch";
import { checkCsrf } from "@/lib/csrf";
import { detectEdgeBlock, edgeBlockedResponse } from "@/lib/edge-block";
import { log429, markLogged } from "@/lib/log-429";

/**
 * POST /api/auth/register → POST {BACKEND}/auth/register
 * Setea cookie httpOnly con el JWT local.
 * Solo acepta JSON del mismo origen (ver lib/csrf.js).
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

  // 403/429 sin JSON: no lo respondió el backend (ver lib/edge-block.js).
  const block = detectEdgeBlock(res);
  if (block) {
    return edgeBlockedResponse(block, { method: "POST", path: "/auth/register" });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const failed = NextResponse.json(
      {
        error: data?.error || "Register failed",
        message: data?.message || `Error HTTP ${res.status}`,
      },
      { status: res.status }
    );
    if (res.status !== 429) return failed;
    log429({ source: "backend", method: "POST", route: "/auth/register", res, bodyText: data?.message });
    return markLogged(failed);
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
