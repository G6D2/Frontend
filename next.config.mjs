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
// - connect-src 'self': el browser solo habla con el BFF; el geocoding y el
//   backend van del lado del servidor.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.tile.openstreetmap.org",
  "connect-src 'self'",
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
    // /api/analitica es el HTML del tablero, y /ops/analitica lo muestra en un
    // iframe del mismo origen. DENY y frame-ancestors 'none' dejan ese iframe
    // en blanco aunque Analítica haya respondido 200. SAMEORIGIN alcanza: la
    // cookie de sesión no sale del sitio y otro origen no puede enmarcarlo.
    const embedHeaders = securityHeaders.map((header) => {
      if (header.key === "X-Frame-Options") return { ...header, value: "SAMEORIGIN" };
      if (header.key !== "Content-Security-Policy") return header;
      return {
        ...header,
        value: header.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
      };
    });
    return [
      { source: "/api/analitica", headers: embedHeaders },
      { source: "/((?!api/analitica).*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
