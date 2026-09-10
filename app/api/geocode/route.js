import { NextResponse } from "next/server";
import { reverseGeocodeServer } from "@/lib/geocode-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?lat=&lng= → { label: string|null }
 * Proxy con caché y cola hacia Nominatim (ver lib/geocode-server.js).
 * Requiere sesión: no es un geocoder público.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Bad Request", message: "lat/lng inválidos" }, { status: 400 });
  }
  const label = await reverseGeocodeServer(lat, lng);
  return NextResponse.json(
    { label },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
