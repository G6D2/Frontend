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
//  "backend" (valor actual)
//    hasAntipanicButton viene de GET /api/user (claim has_antipanic_button del JWT).
//
//  ▶ Solo usar "mock" para demos locales sin backend.
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

// ── DEMO_LOGIN_SHORTCUTS ───────────────────────────────────────────────────────
//
//  Botones de /acceso que entran directo con loginDev (POST /auth/dev/login),
//  sin contraseña. No se muestran con NEXT_PUBLIC_AUTH_MODE=idp. Cada `sub` tiene
//  que estar en DEV_LOGIN_ALLOWLIST del backend (src/auth/dev-login-policy.js):
//  con DEV_LOGIN_STRICT los claims (groups, has_antipanic_button) salen de esa
//  allowlist y lo que manda el front se ignora. Los oficiales usan el id del
//  catálogo `officers` como sub porque el backend compara sub con
//  assigned_officer_id para dejarlos avanzar el estado.
//
// loginDev toma solo sub, preferred_username, groups y hasAntipanicButton:
// el email de la cuenta no viaja.
const JUAN_PANICO = DEMO_ACCOUNTS.find((a) => a.sub === "CIT-JuanPanico");

export const DEMO_LOGIN_SHORTCUTS = [
  {
    id: "dispatcher",
    label: "Dispatcher",
    icon: "radio_button_checked",
    account: DISPATCHER_DEMO,
  },
  {
    id: "of-001",
    label: "Oficial of-001",
    icon: "local_police",
    account: {
      sub: "of-001",
      preferred_username: "Oficial Carlos Gómez",
      groups: ["officer"],
      hasAntipanicButton: false,
    },
  },
  {
    id: "of-002",
    label: "Oficial of-002",
    icon: "local_police",
    account: {
      sub: "of-002",
      preferred_username: "Oficial Mariana López",
      groups: ["officer"],
      hasAntipanicButton: false,
    },
  },
  {
    id: "juan-panico",
    label: "Ciudadano con SOS",
    icon: "emergency",
    account: JUAN_PANICO,
  },
];


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
