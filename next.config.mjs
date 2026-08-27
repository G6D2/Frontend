/** @type {import('next').NextConfig} */
const nextConfig = {
  // El dev server de Next bloquea con 403 los assets (/_next/*) cuando se accede
  // con un host distinto de localhost. Estas son las IPs del server (Tailscale y LAN)
  // desde las que el equipo abre el front en desarrollo.
  allowedDevOrigins: ["100.88.28.30", "192.168.100.246"],
};

export default nextConfig;
