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
//    hasAntipanicButton viene de GET /api/user (claim has_antipanic_button del JWT).
//
//  ▶ PARA CONECTAR CON EL BACKEND: cambiar "mock" → "backend".
//
export const ANTIPANIC_MODE = "backend";

// ── DEMO_ACCOUNTS ──────────────────────────────────────────────────────────────
//
//  Atajos de presentación (chips en el login). Solo rellenan el email;
//  la password NO viaja en el bundle (seed V16: abracadabra — ver README).
//  Cualquier email puede registrarse vía POST /auth/register.
//
export const DEMO_ACCOUNTS = [
  {
    email: "juanpanico@gmail.com",        // case-insensitive
    sub: "CIT-JuanPanico",
    preferred_username: "JuanPanico",
    groups: ["citizen"],
    hasAntipanicButton: true,
  },
  {
    email: "luciatranquila@gmail.com",    // case-insensitive
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
