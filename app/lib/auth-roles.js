/**
 * Helpers de rol (sin I/O). Usables en server y client.
 *
 * NOTA DE SEGURIDAD:
 * Estas funciones se usan para renderizado condicional en la UI y redirección de conveniencia (UX).
 * Toda la protección real de roles y permisos reside en el BACKEND; el frontend no actúa como barrera de seguridad de roles.
 */

export function isDispatcher(user) {
  if (!Array.isArray(user?.groups)) return false;
  return user.groups.some(
    (g) =>
      typeof g === "string" &&
      (g.toLowerCase() === "dispatcher" || g.toLowerCase() === "delegados")
  );
}

export function isCitizen(user) {
  if (!Array.isArray(user?.groups)) return false;
  return user.groups.some(
    (g) => typeof g === "string" && g.toLowerCase() === "citizen"
  );
}

// TODO(back): grupo `officer` + guards de pantallas de terreno (HU-08/09/10)
export function isOfficer(user) {
  return Array.isArray(user?.groups) && user.groups.includes("officer");
}

export function getHomePathForUser(user) {
  if (isDispatcher(user)) return "/ops";
  return "/inicio";
}
