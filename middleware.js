import { NextResponse } from "next/server";
import { isTokenExpired } from "@/lib/jwt";
import { SESSION_COOKIE } from "@/lib/session";
import { decodeJwtPayload } from "@/lib/jwt";
import { getHomePathForUser } from "@/app/lib/auth-roles";

const PUBLIC_PREFIXES = [
  "/acceso",
  "/api/auth/login",
  "/api/auth/logout",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isProtected(pathname) {
  return (
    pathname.startsWith("/inicio") ||
    pathname.startsWith("/reportar") ||
    pathname.startsWith("/mis-alertas") ||
    pathname.startsWith("/perfil") ||
    pathname.startsWith("/ops")
  );
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
      if (token) {
        res.cookies.set(SESSION_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return res;
    }
    return NextResponse.next();
  }

  if (pathname === "/acceso" && valid) {
    const payload = decodeJwtPayload(token);
    const user = {
      groups: Array.isArray(payload?.groups) ? payload.groups : [],
    };
    return NextResponse.redirect(
      new URL(getHomePathForUser(user), request.url)
    );
  }

  if (isProtected(pathname) && !valid) {
    const res = NextResponse.redirect(new URL("/acceso", request.url));
    if (token) {
      res.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return res;
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
