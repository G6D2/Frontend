import { NextResponse } from "next/server";

/**
 * POST /api/auth/register
 *
 * Registro de nueva cuenta ciudadana.
 *
 * -- Estado actual --------------------------------------------------------------
 * TODO(back): Implementar cuando el IdP este disponible (HU-12).
 * Por ahora devuelve 501 para que el frontend lo detecte y muestre el mensaje
 * de "registro no disponible aun".
 *
 * -- Contrato esperado (backend real) ------------------------------------------
 * Request body:
 *   {
 *     "email": "string",              // CUIL o correo electronico
 *     "password": "string",
 *     "preferred_username": "string"  // opcional
 *   }
 *
 * Response 201:
 *   {
 *     "success": true,
 *     "access_token": "string",   // JWT firmado por el IdP
 *     "expires_in": 900,
 *     "user": {
 *       "sub": "string",
 *       "username": "string",
 *       "groups": ["citizen"],
 *       "hasAntipanicButton": false
 *     }
 *   }
 *
 * Response 409 (email ya registrado):
 *   { "error": "Conflict", "message": "El correo ya esta en uso." }
 *
 * Response 422 (validacion):
 *   { "error": "Unprocessable Entity", "message": "..." }
 *
 * -- Integracion ----------------------------------------------------------------
 * Para activar, reemplazar el cuerpo de esta funcion por:
 *
 *   import { BACKEND_URL, sessionCookieOptions, userFromJwt } from "@/lib/session";
 *   import { fetchBackend } from "@/lib/backend-fetch";
 *
 *   const res = await fetchBackend(`${BACKEND_URL}/auth/register`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json", Accept: "application/json" },
 *     body: JSON.stringify(body),
 *   });
 *   // ... (mismo patron que login/route.js)
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Not Implemented",
      message:
        "El registro de cuentas no esta disponible aun. Proximamente con el IdP (HU-12).",
    },
    { status: 501 }
  );
}
