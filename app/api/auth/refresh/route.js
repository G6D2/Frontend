import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  sessionCookieOptions,
  refreshCookieOptions,
  readAccessToken,
  readRefreshToken,
  userFromJwt,
} from "@/lib/session";
import { checkCsrf } from "@/lib/csrf";

function idpError(sessionActive, message) {
  return NextResponse.json(
    { error: "Bad Gateway", reason: "idp_error", sessionActive, message },
    { status: 502 }
  );
}

/**
 * POST /api/auth/refresh
 * Canjea el refresh token actual por un nuevo access token y refresh token rotativo
 * según el contrato del IdP LDAP de CityPass+.
 *
 * Solo las sesiones del Login Federado tienen refresh token: la cookie
 * `citypass_refresh` la setea el login cuando el IdP devuelve uno, y el login
 * local (atajos demo, email/contraseña del backend) la borra. Sin esa cookie
 * no se llama al IdP.
 *
 * Los errores devuelven `reason` y `sessionActive` (si el access token actual
 * sigue vigente), porque el browser no puede leer las cookies httpOnly y
 * SessionRefreshManager decide con eso si manda a /acceso
 * (app/lib/sessionRefresh.js):
 *   - no_refresh_token (401): sesión local, no hay nada que refrescar.
 *   - refresh_rejected (401): el IdP rechazó el refresh token. Se borra esa
 *     cookie; la de sesión se deja mientras siga vigente.
 *   - idp_error (502): el IdP no respondió, devolvió 5xx o no mandó
 *     access_token. No se toca ninguna cookie.
 */
export async function POST(request) {
  // Sin body: solo se exige mismo origen (ver lib/csrf.js).
  const rejected = checkCsrf(request, { json: false });
  if (rejected) return rejected;

  const sessionActive = Boolean(await readAccessToken());

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        reason: "no_refresh_token",
        sessionActive,
        message: "La sesión no tiene refresh token (no viene del Login Federado).",
      },
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
    return idpError(sessionActive, "No se pudo conectar con el IdP.");
  }

  const cookieClearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };

  if (res.status >= 500) {
    return idpError(sessionActive, `El IdP respondió ${res.status}.`);
  }

  if (!res.ok) {
    const response = NextResponse.json(
      {
        error: "Unauthorized",
        reason: "refresh_rejected",
        sessionActive,
        message: data?.message || "Sesión expirada o refresh token inválido.",
      },
      { status: 401 }
    );
    response.cookies.set(REFRESH_COOKIE, "", cookieClearOptions);
    if (!sessionActive) {
      response.cookies.set(SESSION_COOKIE, "", cookieClearOptions);
    }
    return response;
  }

  const newAccessToken = data?.access_token;
  const newRefreshToken = data?.refresh_token;

  if (!newAccessToken) {
    return idpError(sessionActive, "El IdP no devolvió access_token.");
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
