import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  sessionCookieOptions,
  refreshCookieOptions,
  readRefreshToken,
  userFromJwt,
} from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/auth/refresh
 * Canjea el refresh token actual por un nuevo access token y refresh token rotativo
 * según el contrato del IdP LDAP de CityPass+.
 */
export async function POST(request) {
  // Sin body: solo se exige mismo origen (ver lib/csrf.js).
  const rejected = checkCsrf(request, { json: false });
  if (rejected) return rejected;

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return NextResponse.json(
      { error: "Unauthorized", message: "No hay sesión activa para refrescar." },
      { status: 401 }
    );
  }

  const idpRefreshUrl =
    process.env.CITYPASS_IDP_REFRESH_URL ||
    "https://api.citypass-login.pp.ua/auth/refresh";

  let res;
  let data;
  try {
    res = await fetch(idpRefreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });
    data = await res.json().catch(() => null);
  } catch {
    return NextResponse.json(
      { error: "Bad Gateway", message: "No se pudo conectar con el IdP." },
      { status: 502 }
    );
  }

  const cookieClearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };

  if (!res || !res.ok) {
    const response = NextResponse.json(
      {
        error: "Unauthorized",
        message: data?.message || "Sesión expirada o refresh token inválido.",
      },
      { status: 401 }
    );
    response.cookies.set(SESSION_COOKIE, "", cookieClearOptions);
    response.cookies.set(REFRESH_COOKIE, "", cookieClearOptions);
    return response;
  }

  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token;

  if (!newAccessToken) {
    return NextResponse.json(
      { error: "Bad Gateway", message: "El IdP no devolvió access_token." },
      { status: 502 }
    );
  }

  const user = userFromJwt(newAccessToken);
  const response = NextResponse.json({
    success: true,
    user,
    expires_in: data.expires_in || 900,
  });

  response.cookies.set(
    SESSION_COOKIE,
    newAccessToken,
    sessionCookieOptions(newAccessToken)
  );

  // El refresh token rota en cada llamada según la especificación del Grupo 2
  if (newRefreshToken) {
    response.cookies.set(
      REFRESH_COOKIE,
      newRefreshToken,
      refreshCookieOptions()
    );
  }

  return response;
}
