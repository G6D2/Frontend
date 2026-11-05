import { cookies } from "next/headers";
import { decodeJwtPayload, getTokenMaxAgeSeconds, isTokenExpired } from "./jwt";

export const SESSION_COOKIE = "citypass_session";
export const REFRESH_COOKIE = "citypass_refresh";

export const BACKEND_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

export function sessionCookieOptions(token) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getTokenMaxAgeSeconds(token, 900),
  };
}

export function refreshCookieOptions(maxAge = 28800) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: typeof maxAge === "number" ? maxAge : 28800, // 8h según guía LDAP
  };
}

export async function readRefreshToken() {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value || null;
}

export async function readAccessToken() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || isTokenExpired(token)) return null;
  return token;
}

export function userFromJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  const toArray = (val) =>
    Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
  const rawGroups = [
    ...toArray(payload.groups),
    ...toArray(payload.roles),
    ...toArray(payload.role),
    ...toArray(payload.group),
  ];
  return {
    sub: payload.sub,
    username: payload.preferred_username || payload.username || payload.sub,
    groups: rawGroups,
    roles: payload.roles,
    role: payload.role,
  };
}

export async function getServerSession() {
  const token = await readAccessToken();
  if (!token) return null;
  const user = userFromJwt(token);
  if (!user) return null;
  return {
    token,
    user,
  };
}
