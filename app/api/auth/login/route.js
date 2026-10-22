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

  let data = await res.json().catch(() => null);

  // En modo IdP real (LOGIN Federado), el backend autentica contra LDAP vía el
  // IdP del Grupo 2. No hay fallback a dev/login: el error se propaga al usuario.
  //
  // En modo local (dev/demo), si el backend no tiene /auth/login (404), derivamos
  // a /auth/dev/login para que los atajos demo sigan funcionando sin cambiar el form.
  if (isCredentialLogin && res.status === 404 && !IS_IDP_MODE) {
    const devSub = body.email.split("@")[0];
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
    const demoAccount = findDemoAccount(body.email);
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

