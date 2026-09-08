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
//    El campo hasAntipanicButton se gestiona íntegramente en el frontend:
//    - El formulario de login muestra un toggle para activarlo/desactivarlo.
//    - El valor viaja en el body del POST /api/auth/login y se almacena en sessionStorage.
//
//  "backend"
//    El campo hasAntipanicButton proviene del backend:
//    - TODO(back): GET /api/user debe devolver { hasAntipanicButton: boolean } en data.
//    - El toggle del formulario de login se oculta automáticamente.
//    - InicioClient lee el valor directamente de la respuesta fresca de /api/auth/session.
//
//  ▶ PARA CONECTAR CON EL BACKEND: cambiar "mock" → "backend" y asegurarse de que
//    el endpoint GET /api/user del backend exponga el campo en el objeto data del usuario.
//
export const ANTIPANIC_MODE = "mock"; // TODO(back): cambiar a "backend" en HU-antipanico
