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
//  Atajos de presentación (chips en el login): completan el email y la
//  contraseña de las cuentas ciudadanas de demo del seed V16 (fillDemo en
//  AccesoForm). Esa contraseña es pública a propósito y está en el bundle:
//  son ciudadanos de demo, sin permisos de personal. Las cuentas de personal
//  no tienen atajo con contraseña: entran por el Login Federado (LDAP) y la
//  contraseña se escribe. Cualquier email puede registrarse vía
//  POST /auth/register.
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

// ── DEMO_LOGIN_SHORTCUTS ───────────────────────────────────────────────────────
//
//  Botones de /acceso que entran directo con loginDev (POST /auth/dev/login),
//  sin contraseña. No se muestran con NEXT_PUBLIC_AUTH_MODE=idp. Cada `sub` tiene
//  que estar en DEV_LOGIN_ALLOWLIST del backend (src/auth/dev-login-policy.js):
//  con DEV_LOGIN_STRICT los claims (groups, has_antipanic_button) salen de esa
//  allowlist y lo que manda el front se ignora.
//
//  Solo ciudadanos: el endpoint es público, así que un atajo de dispatcher u
//  oficial le daba ese rol a cualquiera. El backend ya no los emite en modo
//  estricto (issue #73 del board). El personal entra por el Login Federado:
//  el dispatcher de prueba tiene su acceso directo LDAP en el panel de la llave.
//
// loginDev toma solo sub, preferred_username, groups y hasAntipanicButton:
// el email de la cuenta no viaja.
const JUAN_PANICO = DEMO_ACCOUNTS.find((a) => a.sub === "CIT-JuanPanico");

export const DEMO_LOGIN_SHORTCUTS = [
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
