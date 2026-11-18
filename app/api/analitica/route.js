import { NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend-fetch";
import { BACKEND_URL, readAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

// El iframe apunta acá, mismo origen. La cookie httpOnly se convierte en el
// Bearer que el backend reenvía a Analítica. El token no va en la URL.
const FORWARDED_HEADERS = [
  "content-type",
  "cache-control",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
];

export async function GET() {
  const token = await readAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sesión expirada. Volvé a iniciar sesión." },
      { status: 401 }
    );
  }

  let backendRes;
  try {
    const headers = new Headers();
    headers.set("Accept", "text/html");
    headers.set("Authorization", `Bearer ${token}`);
    backendRes = await fetchBackend(`${BACKEND_URL}/admin/analitica`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Bad Gateway", message: "El backend no responde. Probá de nuevo en unos segundos." },
      { status: 502 }
    );
  }

  const body = await backendRes.text();
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = backendRes.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) {
    headers.set("Content-Type", "text/html; charset=utf-8");
  }
  if (!headers.has("cache-control")) {
    headers.set("Cache-Control", "no-store");
  }

  return new NextResponse(body, { status: backendRes.status, headers });
}
