import { cookies } from "next/headers";
import { decodeJwtPayload, getTokenMaxAgeSeconds, isTokenExpired } from "./jwt";

export const SESSION_COOKIE = "citypass_session";

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

export async function readAccessToken() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || isTokenExpired(token)) return null;
  return token;
}

export async function getServerSession() {
  const token = await readAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  const rawGroups = [
    ...(Array.isArray(payload.groups) ? payload.groups : (typeof payload.groups === "string" ? [payload.groups] : [])),
    ...(Array.isArray(payload.roles) ? payload.roles : (typeof payload.roles === "string" ? [payload.roles] : [])),
    ...(typeof payload.role === "string" ? [payload.role] : []),
    ...(typeof payload.group === "string" ? [payload.group] : []),
  ];
  return {
    token,
    user: {
      sub: payload.sub,
      username: payload.preferred_username || payload.username || payload.sub,
      groups: rawGroups,
      roles: payload.roles,
      role: payload.role,
    },
  };
}

export function userFromJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  const rawGroups = [
    ...(Array.isArray(payload.groups) ? payload.groups : (typeof payload.groups === "string" ? [payload.groups] : [])),
    ...(Array.isArray(payload.roles) ? payload.roles : (typeof payload.roles === "string" ? [payload.roles] : [])),
    ...(typeof payload.role === "string" ? [payload.role] : []),
    ...(typeof payload.group === "string" ? [payload.group] : []),
  ];
  return {
    sub: payload.sub,
    username: payload.preferred_username || payload.username || payload.sub,
    groups: rawGroups,
    roles: payload.roles,
    role: payload.role,
  };
}
