/**
 * Feature flags del frontend CityPass+.
 *
 * Este archivo es el ÚNICO punto de control para cambiar entre modo mock (desarrollo/demo)
 * y modo backend (producción con endpoints reales).
 *
 * Es importable tanto desde componentes cliente como desde Route Handlers del servidor.
 */

// ── ANTIPANIC_MODE ─────────────────────────────────────────────────────────────
//
//  "mock"
//    El campo hasAntipanicButton se determina por las cuentas demo (DEMO_ACCOUNTS).
//    El valor viaja en el body del POST /api/auth/login y se almacena en sessionStorage.
//
//  "backend"
//    El campo hasAntipanicButton proviene del backend:
//    - TODO(back): GET /api/user debe devolver { hasAntipanicButton: boolean } en data.
//    - InicioClient lee el valor directamente de la respuesta fresca de /api/auth/session.
//
//  ▶ PARA CONECTAR CON EL BACKEND: cambiar "mock" → "backend" y asegurarse de que
//    el endpoint GET /api/user del backend exponga el campo en el objeto data del usuario.
//
export const ANTIPANIC_MODE = "mock"; // TODO(back): cambiar a "backend" en HU-antipanico

// ── DEMO_ACCOUNTS ──────────────────────────────────────────────────────────────
//
//  Cuentas de demostración locales. Identificadas por email (case-insensitive).
//  Solo activas cuando AUTH_MODE=local (backend dev/login). El backend real
//  reemplazará estas credenciales con un IdP (HU-12).
//
//  Campos:
//    email           — identificador que el usuario ingresa en el formulario
//    password        — contraseña que valida el frontend antes de llamar al BFF
//    sub             — subject ID que se envía al backend de desarrollo
//    preferred_username — nombre visible en la UI
//    hasAntipanicButton — si la cuenta tiene habilitado el botón antipánico
//
export const DEMO_ACCOUNTS = [
  {
    email: "juanpanico@gmail.com",        // case-insensitive
    password: "abracadabra",
    sub: "CIT-JuanPanico",
    preferred_username: "JuanPanico",
    groups: ["citizen"],
    hasAntipanicButton: true,
  },
  {
    email: "luciatranquila@gmail.com",    // case-insensitive
    password: "abracadabra",
    sub: "CIT-LuciaTranquila",
    preferred_username: "LuciaTranquila",
    groups: ["citizen"],
    hasAntipanicButton: false,
  },
];

// Cuenta demo fija para el dispatcher (acceso directo desde el login, sin contraseña).
// No está en DEMO_ACCOUNTS porque no se valida por email+password sino por botón directo.
export const DISPATCHER_DEMO = {
  sub: "DISP-Demo001",
  preferred_username: "Dispatcher Demo",
  groups: ["dispatcher"],
  hasAntipanicButton: false,
};


/**
 * Busca una cuenta demo por email (case-insensitive).
 * Devuelve null si el email no corresponde a ninguna cuenta demo.
 * @param {string} email
 * @returns {object|null}
 */
export function findDemoAccount(email) {
  if (!email) return null;
  return DEMO_ACCOUNTS.find((a) => a.email === email.toLowerCase().trim()) ?? null;
}

