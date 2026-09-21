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
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");

  // Number(null) === 0 y Number("") === 0: sin este chequeo, un request sin
  // parámetros pasaba la validación de abajo y se geocodificaba (0,0), que
  // Nominatim resuelve como "océano Atlántico".
  if (latParam === null || latParam === "" || lngParam === null || lngParam === "") {
    return NextResponse.json(
      { error: "Bad Request", message: "lat/lng son requeridos" },
      { status: 400 }
    );
  }

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Bad Request", message: "lat/lng inválidos" }, { status: 400 });
  }
  const label = await reverseGeocodeServer(lat, lng);
  return NextResponse.json(
    { label },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
