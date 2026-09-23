import { NextResponse } from "next/server";
import { isTokenExpired } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeJwtPayload } from "@/lib/jwt";
import { getHomePathForUser, isDispatcher } from "@/app/lib/auth-roles";

/**
 * Guard UX de rutas (existencia de cookie + exp).
 * La autoridad criptográfica es el backend (verifica firma RS256).
 * Este middleware NO valida la firma del JWT.
 */

const PUBLIC_PREFIXES = [
  "/acceso",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/_next",
  "/favicon.ico",
];

const CITIZEN_PREFIXES = ["/inicio", "/reportar", "/mis-alertas", "/perfil"];
const OPS_PREFIXES = ["/ops"];

function isPublic(pathname) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isProtected(pathname) {
  return (
    CITIZEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    OPS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
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
  return {
    groups: Array.isArray(payload?.groups) ? payload.groups : [],
  };
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = Boolean(token) && !isTokenExpired(token);

  if (pathname.startsWith("/api/backend") || pathname.startsWith("/api/auth/session")) {
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

  if (pathname === "/acceso" && valid) {
    return NextResponse.redirect(
      new URL(getHomePathForUser(userFromToken(token)), request.url)
    );
  }

  if (isProtected(pathname) && !valid) {
    const res = NextResponse.redirect(new URL("/acceso", request.url));
    if (token) clearSessionCookie(res);
    return res;
  }

  // Guard de rol (UX): citizen ↔ ops. El backend sigue siendo la autoridad.
  if (valid && isProtected(pathname)) {
    const user = userFromToken(token);
    const dispatcher = isDispatcher(user);

    if (matchesAny(pathname, OPS_PREFIXES) && !dispatcher) {
      return NextResponse.redirect(new URL("/inicio", request.url));
    }
    if (matchesAny(pathname, CITIZEN_PREFIXES) && dispatcher) {
      return NextResponse.redirect(new URL("/ops", request.url));
    }
  }

  if (isPublic(pathname) || !isProtected(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
