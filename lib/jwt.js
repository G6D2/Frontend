/** Margen en segundos antes de considerar el token vencido. */
export const EXPIRY_SKEW_SECONDS = 30;

function base64UrlToJson(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  if (typeof Buffer !== "undefined") {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  }
  return JSON.parse(atob(padded));
}

/**
 * Decodifica el payload de un JWT (sin verificar firma).
 * La firma la valida el backend / IdP.
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return base64UrlToJson(parts[1]);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewSeconds = EXPIRY_SKEW_SECONDS) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}

export function getTokenMaxAgeSeconds(token, fallback = 900) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return fallback;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}
