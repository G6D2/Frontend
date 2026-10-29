import { NextResponse } from "next/server";
import { SESSION_COOKIE, REFRESH_COOKIE, readRefreshToken } from "@/lib/session";

export async function POST() {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
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

  const response = NextResponse.json({ success: true });
  const cookieClearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
  response.cookies.set(SESSION_COOKIE, "", cookieClearOptions);
  response.cookies.set(REFRESH_COOKIE, "", cookieClearOptions);
  return response;
}

export async function GET(request) {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
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
      // silenciar
    }
  }

  const response = NextResponse.redirect(new URL("/acceso", request.url));
  const cookieClearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
  response.cookies.set(SESSION_COOKIE, "", cookieClearOptions);
  response.cookies.set(REFRESH_COOKIE, "", cookieClearOptions);
  return response;
}
