/**
 * Helpers de rol (sin I/O). Usables en server y client.
 *
 * NOTA DE SEGURIDAD:
 * Estas funciones se usan para renderizado condicional en la UI y redirección de conveniencia (UX).
 * Toda la protección real de roles y permisos reside en el BACKEND; el frontend no actúa como barrera de seguridad de roles.
 */

function getUserRoleTokens(user) {
  if (!user) return [];
  const toArray = (val) =>
    Array.isArray(val) ? val : typeof val === "string" ? [val] : [];
  return [
    ...toArray(user.groups),
    ...toArray(user.roles),
    ...toArray(user.role),
    ...toArray(user.group),
  ]
    .filter((g) => typeof g === "string")
    .map((g) => g.trim().toLowerCase());
}

export function isDispatcher(user) {
  const list = getUserRoleTokens(user);
  return list.some(
    (g) => g === "dispatcher" || g === "dispatchers" || g === "operador"
  );
}

export function isDelegado(user) {
  const list = getUserRoleTokens(user);
  return list.some((g) => g === "delegados" || g === "delegado");
}

export function isCitizen(user) {
  return getUserRoleTokens(user).includes("citizen");
}

// `poli` es el grupo LDAP de los oficiales en el Login Federado. El backend
// lo traduce a `officer`, pero el middleware decide la ruta con los grupos
// crudos del token, así que el front también tiene que reconocerlo.
export function isOfficer(user) {
  const list = getUserRoleTokens(user);
  return list.some((g) => g === "officer" || g === "poli");
}

export function getHomePathForUser(user) {
  if (isDelegado(user)) {
    return process.env.NEXT_PUBLIC_LDAP_PANEL_URL || "https://citypass-login.pp.ua";
  }
  if (isDispatcher(user)) return "/ops";
  if (isOfficer(user)) return "/oficial";
  return "/inicio";
}
