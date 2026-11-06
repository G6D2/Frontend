import { NextResponse } from "next/server";
import { SESSION_COOKIE, REFRESH_COOKIE, readRefreshToken } from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 0,
};

/** Revoca el refresh token en el IdP. Un fallo de red no bloquea el logout local. */
async function revokeIdpSession() {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return;
  try {
    const idpLogoutUrl =
      process.env.CITYPASS_IDP_LOGOUT_URL ||
      "https://api.citypass-login.pp.ua/auth/logout";
    await fetch(idpLogoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // no bloquear logout del cliente ante fallo de red del IdP
  }
}

function clearSessionCookies(response) {
  response.cookies.set(SESSION_COOKIE, "", CLEAR_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_COOKIE, "", CLEAR_COOKIE_OPTIONS);
  return response;
}

export async function POST(request) {
  // Sin body: solo se exige mismo origen (ver lib/csrf.js).
  const rejected = checkCsrf(request, { json: false });
  if (rejected) return rejected;

  await revokeIdpSession();
  return clearSessionCookies(NextResponse.json({ success: true }));
}

export async function GET(request) {
  await revokeIdpSession();
  return clearSessionCookies(
    NextResponse.redirect(new URL("/acceso", request.url))
  );
}
