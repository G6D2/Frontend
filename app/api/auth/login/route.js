import { NextResponse } from "next/server";
import {
  BACKEND_URL,
  SESSION_COOKIE,
  sessionCookieOptions,
  userFromJwt,
} from "@/lib/session";
import { ANTIPANIC_MODE, findDemoAccount } from "@/app/lib/features";
import { fetchBackend } from "@/lib/backend-fetch";

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
 */

const IS_IDP_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "idp";

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

  // ── Flujo 0: Token LDAP directo pasado en el body
  const directToken = body.token || body.accessToken;
  if (typeof directToken === "string" && directToken.trim()) {
    const trimmed = directToken.trim();
    const user = userFromJwt(trimmed);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid token", message: "El token JWT provisto no es válido o está malformado." },
        { status: 400 }
      );
    }
    const response = NextResponse.json({
      success: true,
      user,
      expires_in: 900,
    });
    response.cookies.set(SESSION_COOKIE, trimmed, sessionCookieOptions(trimmed));
    return response;
  }

  const rawIdentifier = (body.username || body.email || "").trim();
  const isCredentialLogin =
    Boolean(rawIdentifier) && typeof body.password === "string";

  const isLdapLogin =
    isCredentialLogin &&
    (body.loginType === "ldap" ||
      body.loginMethod === "ldap" ||
      body.provider === "ldap" ||
      (IS_IDP_MODE && body.loginType !== "password"));

  let res;
  let data;

  if (isLdapLogin) {
    const idpUrl =
      process.env.CITYPASS_IDP_AUTH_URL ||
      "https://api.citypass-login.pp.ua/auth/login";
    const clientId =
      process.env.CITYPASS_IDP_CLIENT_ID || "citypass-emergencias-api";
    const username = rawIdentifier.includes("@")
      ? rawIdentifier.split("@")[0].trim()
      : rawIdentifier;

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
      });
      data = await res.json().catch(() => null);
    } catch {
      // red / timeout
    }

    // Si falló el IdP externo (o estamos en local/testing), pero las credenciales
    // corresponden al dispatcher demo o usuario de prueba con dispatcher:
    if (!res || !res.ok) {
      const isDispatcherUser =
        username.toLowerCase() === "dispatcher" ||
        username.toLowerCase().includes("dispatcher") ||
        username.toLowerCase() === "delegado-emer" ||
        username.toLowerCase() === "delegados";

      if (!IS_IDP_MODE || isDispatcherUser) {
        try {
          const devRes = await fetchBackend(`${BACKEND_URL}/auth/dev/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              sub: username || "DISP-Demo001",
              preferred_username: username || "Dispatcher Demo",
              groups: ["dispatcher"],
            }),
          });
          if (devRes.ok) {
            data = await devRes.json().catch(() => null);
            res = devRes;
          }
        } catch {
          // ignore dev fallback failure
        }
      }
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

    // En modo local (dev/demo), si el backend no tiene /auth/login (404), derivamos
    // a /auth/dev/login para que los atajos demo sigan funcionando sin cambiar el form.
    if (isCredentialLogin && res.status === 404 && !IS_IDP_MODE) {
      const devSub = rawIdentifier.split("@")[0];
      let devRes;
      try {
        devRes = await fetchBackend(`${BACKEND_URL}/auth/dev/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sub: devSub,
            preferred_username: devSub,
            groups: body.groups || ["citizen"],
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

  // En modo local, si el backend dev no incluye has_antipanic_button en el JWT,
  // lo leemos de DEMO_ACCOUNTS por email.
  if (!IS_IDP_MODE && isCredentialLogin && typeof user.hasAntipanicButton !== "boolean") {
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
  return response;
}

