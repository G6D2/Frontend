/**
 * Middleware de sesión y guard UX de rutas.
 *
 * - Valida presencia/vigencia de la cookie httpOnly (JWT) para rutas privadas.
 * - Guard de rol citizen ↔ ops (UX): evita que un dispatcher abra /inicio o un
 *   citizen abra /ops. La autoridad criptográfica y de autorización sigue siendo
 *   el backend (firma RS256 + groups); acá no se valida la firma del JWT.
 * - getHomePathForUser es solo conveniencia de navegación al ya estar logueado.
 */

import { NextResponse } from "next/server";
import { isTokenExpired } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeJwtPayload } from "@/lib/jwt";
import { isDispatcher, isDelegado, isOfficer } from "@/app/lib/auth-roles";

/**
 * Guard UX de rutas (existencia de cookie + exp).
 * La autoridad criptográfica es el backend (verifica firma RS256).
 * Este middleware NO valida la firma del JWT.
 */

const CITIZEN_PREFIXES = ["/inicio", "/reportar", "/mis-alertas", "/perfil"];
const OPS_PREFIXES = ["/ops"];
const OFFICER_PREFIXES = ["/oficial"];

/**
 * Rutas que requieren sesión activa (autenticación).
 * El guard de rol citizen/ops se aplica más abajo; la autorización fina es del backend.
 */
function isProtected(pathname) {
  return (
    matchesAny(pathname, CITIZEN_PREFIXES) ||
    matchesAny(pathname, OPS_PREFIXES) ||
    matchesAny(pathname, OFFICER_PREFIXES)
  );
}

function matchesAny(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function clearSessionCookie(res) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function userFromToken(token) {
  const payload = decodeJwtPayload(token);
  const rawGroups = [
    ...(Array.isArray(payload?.groups) ? payload.groups : (typeof payload?.groups === "string" ? [payload.groups] : [])),
    ...(Array.isArray(payload?.roles) ? payload.roles : (typeof payload?.roles === "string" ? [payload.roles] : [])),
    ...(typeof payload?.role === "string" ? [payload.role] : []),
    ...(typeof payload?.group === "string" ? [payload.group] : []),
  ];
  return {
    sub: payload?.sub,
    username: payload?.preferred_username || payload?.username || payload?.sub,
    groups: rawGroups,
    roles: payload?.roles,
    role: payload?.role,
  };
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = Boolean(token) && !isTokenExpired(token);

  // Rutas del BFF que exigen sesión: 401 JSON en vez de redirect. /api/geocode
  // también lo chequea en el route; acá queda como segunda barrera.
  if (
    matchesAny(pathname, ["/api/backend", "/api/auth/session", "/api/geocode", "/api/analitica"])
  ) {
    if (!valid) {
      const res = NextResponse.json(
        { error: "Unauthorized", message: "Sin sesión" },
        { status: 401 }
      );
      if (token) clearSessionCookie(res);
      return res;
    }
    return NextResponse.next();
  }

  if (pathname === "/logout") {
    const res = NextResponse.redirect(new URL("/acceso", request.url));
    clearSessionCookie(res);
    return res;
  }

  if (pathname === "/acceso") {
    if (request.nextUrl.searchParams.has("logout") || request.nextUrl.searchParams.has("reset")) {
      const res = NextResponse.next();
      clearSessionCookie(res);
      return res;
    }
    if (valid) {
      const user = userFromToken(token);
      if (isDelegado(user)) {
        // Si el usuario era delegado y regresa a /acceso, limpiamos la sesión de delegado
        // para que pueda ver el login de emergencias sin ser expulsado a la URL externa.
        const res = NextResponse.next();
        clearSessionCookie(res);
        return res;
      }
      if (isDispatcher(user)) {
        return NextResponse.redirect(new URL("/ops", request.url));
      }
      if (isOfficer(user)) {
        return NextResponse.redirect(new URL("/oficial", request.url));
      }
      return NextResponse.redirect(new URL("/inicio", request.url));
    }
    return NextResponse.next();
  }

  if (isProtected(pathname) && !valid) {
    const res = NextResponse.redirect(new URL("/acceso", request.url));
    if (token) clearSessionCookie(res);
    return res;
  }

  // Guard de rol (UX): citizen ↔ ops ↔ oficial. El backend sigue siendo la autoridad.
  if (valid && isProtected(pathname)) {
    const user = userFromToken(token);
    const dispatcher = isDispatcher(user);
    // Un oficial (que no sea también dispatcher) solo tiene /oficial: las
    // pantallas de ciudadano le darían 403 "Insufficient group membership".
    const officer = !dispatcher && isOfficer(user);

    if (officer && !matchesAny(pathname, OFFICER_PREFIXES)) {
      return NextResponse.redirect(new URL("/oficial", request.url));
    }
    if (!officer && matchesAny(pathname, OFFICER_PREFIXES)) {
      const target = dispatcher ? "/ops" : "/inicio";
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (matchesAny(pathname, OPS_PREFIXES) && !dispatcher) {
      const target = isDelegado(user)
        ? (process.env.NEXT_PUBLIC_LDAP_PANEL_URL || "https://citypass-login.pp.ua")
        : "/inicio";
      if (target.startsWith("http://") || target.startsWith("https://")) {
        return NextResponse.redirect(new URL(target));
      }
      return NextResponse.redirect(new URL(target, request.url));
    }
    if (matchesAny(pathname, CITIZEN_PREFIXES) && dispatcher) {
      return NextResponse.redirect(new URL("/ops", request.url));
    }
  }

  // Todo lo que no es una ruta protegida (o lo es y pasó los guards) sigue.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
