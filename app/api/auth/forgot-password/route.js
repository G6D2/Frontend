import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/csrf";

/**
 * POST /api/auth/forgot-password
 *
 * Solicita el envio de un enlace de recuperacion de contrasena.
 *
 * -- Estado actual --------------------------------------------------------------
 * TODO(back): Implementar cuando el IdP este disponible (HU-12).
 * Por ahora devuelve 200 (mock) para que el flujo del frontend pueda demostrarse
 * sin exponer si el email existe o no (buena practica de seguridad).
 *
 * -- Contrato esperado (backend real) ------------------------------------------
 * Request body:
 *   {
 *     "email": "string"   // CUIL o correo electronico
 *   }
 *
 * Response 200 (siempre, para no revelar si el email existe):
 *   {
 *     "success": true,
 *     "message": "Si el correo esta registrado, recibiras el enlace en breve."
 *   }
 */
export async function POST(request) {
  const rejected = checkCsrf(request);
  if (rejected) return rejected;

  // Mock: responde 200 siempre (no revela si el email esta registrado)
  return NextResponse.json({
    success: true,
    message: "Si el correo esta registrado, recibiras el enlace en breve.",
  });
}
