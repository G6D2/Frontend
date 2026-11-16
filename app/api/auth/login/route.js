import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  REFRESH_COOKIE,
  sessionCookieOptions,
  refreshCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { ANTIPANIC_MODE, findDemoAccount } from "@/app/lib/features";
import { fetchBackend } from "@/lib/backend-fetch";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/auth/login
 *
 * Flujos soportados:
 *
 * AUTH_MODE=idp (Login Federado — Grupo 2):
 *   - email+password → POST /auth/login del backend, que valida contra el IdP (LDAP).
 *   - No hay fallback a /auth/dev/login: si falla, se propaga el error.
 *
 * AUTH_MODE=local (dev/demo — sin IdP):
 *   - email+password → POST /auth/login. Si devuelve 404 (backend local sin
 *     ese endpoint), deriva a POST /auth/dev/login con sub inferido del email.
 *   - sub (+ groups) → POST /auth/dev/login directamente (atajos demo).
 *
 * Solo acepta JSON del mismo origen (ver lib/csrf.js): sin eso, otro sitio
 * podía loguear a la víctima con una cuenta ajena.
 */

const IS_IDP_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "idp";

// Tope de espera al IdP. Sin esto, si el Login Federado no respondía, el
// login quedaba colgado hasta que cortaba el proxy.
const IDP_TIMEOUT_MS = 8000;

// AbortSignal.timeout corta con un DOMException "TimeoutError", tanto si
// todavía no llegó la respuesta como si se colgó la lectura del cuerpo.
function isTimeout(error) {
  return error?.name === "TimeoutError";
}

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

  const rawIdentifier = (body.username || body.email || "").trim();
  const isCredentialLogin =
    Boolean(rawIdentifier) && typeof body.password === "string";

  const isLdapLogin =
    isCredentialLogin &&
    (body.loginType === "ldap" ||
      body.loginMethod === "ldap" ||
      body.provider === "ldap");

  let res;
  let data;

  if (isLdapLogin) {
    const idpUrl =
      process.env.CITYPASS_IDP_AUTH_URL ||
      "https://api.citypass-login.pp.ua/auth/login";
    const clientId =
      process.env.CITYPASS_IDP_CLIENT_ID || "citypass-emergencias-web";
    const username = rawIdentifier.includes("@")
      ? rawIdentifier.split("@")[0].trim()
      : rawIdentifier;

    let timedOut = false;
    try {
      res = await fetch(idpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username,
          password: body.password,
          clientId,
        }),
        signal: AbortSignal.timeout(IDP_TIMEOUT_MS),
      });
      data = await res.json().catch((error) => {
        if (isTimeout(error)) throw error;
        return null;
      });
    } catch (error) {
      // red / timeout
      timedOut = isTimeout(error);
    }

    if (timedOut) {
      return NextResponse.json(
        {
          error: "Gateway Timeout",
          message: "El Login Federado no responde. Probá de nuevo.",
        },
        { status: 504 }
      );
    }

    if (!res) {
      return NextResponse.json(
        {
          error: "Bad Gateway",
          message: "No se pudo conectar con el servidor de Login Federado (LDAP).",
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data?.error || "Login failed",
          message: data?.message || "Usuario o contraseña inválidos en LDAP",
        },
        { status: res.status }
      );
    }
  } else {
    const backendPath = isCredentialLogin ? "/auth/login" : "/auth/dev/login";
    const backendBody = isCredentialLogin
      ? { email: rawIdentifier, password: body.password }
      : {
          sub: body.sub,
          preferred_username: body.preferred_username,
          groups: body.groups,
        };

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

    data = await res.json().catch(() => null);

    // Si el backend no tiene /auth/login (404), derivamos
    // a /auth/dev/login para que las cuentas ciudadanas/demo funcionen correctamente:
    if (isCredentialLogin && res.status === 404) {
      const demoAccount = findDemoAccount(rawIdentifier);
      const devSub = demoAccount?.sub || rawIdentifier.split("@")[0];
      const devUsername = demoAccount?.preferred_username || devSub;
      const devGroups = demoAccount?.groups || body.groups || ["citizen"];
      let devRes;
      try {
        devRes = await fetchBackend(`${BACKEND_URL}/auth/dev/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sub: devSub,
            preferred_username: devUsername,
            groups: devGroups,
          }),
        });
      } catch {
        return NextResponse.json(
          { error: "Bad Gateway", message: "El backend no responde. Probá de nuevo en unos segundos." },
          { status: 502 }
        );
      }
      data = await devRes.json().catch(() => null);
      if (!devRes.ok) {
        return NextResponse.json(
          { error: data?.error || "Login failed", message: data?.message || `Error HTTP ${devRes.status}` },
          { status: devRes.status }
        );
      }
      res = devRes;
    } else if (!res.ok) {
      return NextResponse.json(
        {
          error: data?.error || "Login failed",
          message: data?.message || `Error HTTP ${res.status}`,
        },
        { status: res.status }
      );
    }
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

  // Si el backend dev no incluye has_antipanic_button en el JWT,
  // lo leemos de DEMO_ACCOUNTS por email para cuentas demo ciudadanas.
  if (isCredentialLogin && typeof user.hasAntipanicButton !== "boolean") {
    const demoAccount = findDemoAccount(rawIdentifier);
    if (demoAccount !== null) {
      user = { ...user, hasAntipanicButton: Boolean(demoAccount.hasAntipanicButton) };
    }
  }

  const response = NextResponse.json({
    success: true,
    user,
    expires_in: data.expires_in,
  });
  response.cookies.set(SESSION_COOKIE, accessToken, sessionCookieOptions(accessToken));
  if (data?.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, data.refresh_token, refreshCookieOptions());
  } else {
    // Login local (dev login o email/contraseña del backend): no hay refresh
    // token. Se borra uno que haya quedado de un Login Federado anterior;
    // si no, /api/auth/refresh lo canjearía en el IdP y pisaría esta sesión
    // con un token que el backend en AUTH_MODE=local rechaza.
    response.cookies.set(REFRESH_COOKIE, "", refreshCookieOptions(0));
  }
  return response;
}

