const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy: solo lo que la app carga de verdad.
// - script-src 'unsafe-inline': Next mete scripts inline para hidratar
//   (self.__next_f) y Mantine el ColorSchemeScript. Sacarlo exige nonces por
//   request desde el middleware y render dinámico de todas las páginas.
//   'unsafe-eval' solo en dev (React lo usa para las trazas de error).
// - style-src 'unsafe-inline': Mantine inyecta <style> con sus variables y
//   Leaflet arma los marcadores con style="..." (OpsMap.js).
//   fonts.googleapis.com sirve la hoja de Material Symbols (layout.js).
// - font-src fonts.gstatic.com: los archivos de Material Symbols. Inter y
//   JetBrains Mono los sirve next/font desde el propio sitio.
// - img-src: tiles de OpenStreetMap ({s}.tile.openstreetmap.org en OpsMap.js)
//   y data: para el GIF vacío con el que Leaflet descarga tiles.
// - frame-src 'self': el iframe de /ops/analitica carga el embed de analítica
//   a través del proxy /api/analytics (mismo origen).
// - connect-src 'self': el browser solo habla con el BFF; el geocoding y el
//   backend van del lado del servidor.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.tile.openstreetmap.org",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El browser lo ignora sobre http (localhost); en Render el front va por https.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// Respuestas del proxy de analítica (/api/analytics/**, el HTML embebido en
// /ops/analitica y sus assets). Es contenido del backend de analítica, no
// nuestro: se puede enmarcar solo desde nuestro origen y se le permiten
// scripts/estilos/imágenes de CDNs https (no sabemos cuáles usa), pero
// connect-src queda en 'self' para que solo hable con el proxy.
const analyticsCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const analyticsHeaders = [
  { key: "Content-Security-Policy", value: analyticsCsp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El dev server de Next bloquea con 403 los assets (/_next/*) cuando se accede
  // con un host distinto de localhost. Los hosts extra (IP de Tailscale, de la
  // LAN, etc.) se pasan por DEV_ALLOWED_ORIGINS, separados por coma, para no
  // dejar direcciones de la red de cada uno en el repo. Solo afecta a `next dev`.
  allowedDevOrigins: (process.env.DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  poweredByHeader: false,
  async headers() {
    return [
      // Todo menos el proxy de analítica (que no se puede enmarcar con DENY).
      { source: "/((?!api/analytics(?:/|$)).*)", headers: securityHeaders },
      { source: "/api/analytics/:path*", headers: analyticsHeaders },
      { source: "/api/analytics", headers: analyticsHeaders },
    ];
  },
};

export default nextConfig;
