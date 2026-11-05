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
  // con un host distinto de localhost. Estas son las IPs del server (Tailscale y LAN)
  // desde las que el equipo abre el front en desarrollo.
  allowedDevOrigins: ["100.88.28.30", "192.168.100.246"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
