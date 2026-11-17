import { NextResponse } from "next/server";
import { reverseGeocodeServer } from "@/lib/geocode-server";
import { readAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?lat=&lng= → { label: string|null }
 * Proxy con caché y cola hacia Nominatim (ver lib/geocode-server.js).
 * Requiere sesión: no es un geocoder público. El middleware ya corta sin
 * sesión (401); el chequeo de acá queda como segunda barrera.
 */
export async function GET(request) {
  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sin sesión" },
      { status: 401 }
    );
  }

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
  // Sin dirección (el proveedor falló o tardó) no se cachea: si no, el
  // navegador guardaba el `label: null` una hora y los reintentos del cliente
  // (app/lib/geocoding.js) ni llegaban al BFF.
  return NextResponse.json(
    { label },
    { headers: { "Cache-Control": label ? "private, max-age=3600" : "no-store" } }
  );
}
