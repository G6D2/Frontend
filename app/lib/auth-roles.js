/**
 * Helpers de rol (sin I/O). Usables en server y client.
 *
 * NOTA DE SEGURIDAD:
 * Estas funciones se usan para renderizado condicional en la UI y redirección de conveniencia (UX).
 * Toda la protección real de roles y permisos reside en el BACKEND; el frontend no actúa como barrera de seguridad de roles.
 */

export function isDispatcher(user) {
  if (!user) return false;
  const groups = Array.isArray(user.groups)
    ? user.groups
    : typeof user.groups === "string"
    ? [user.groups]
    : [];
  const roles = Array.isArray(user.roles)
    ? user.roles
    : typeof user.roles === "string"
    ? [user.roles]
    : [];
  const role = typeof user.role === "string" ? [user.role] : [];
  const group = typeof user.group === "string" ? [user.group] : [];

  const list = [...groups, ...roles, ...role, ...group];

  if (typeof user.username === "string" && user.username.toLowerCase().includes("dispatcher")) {
    list.push("dispatcher");
  }
  if (typeof user.sub === "string" && user.sub.toLowerCase().includes("dispatcher")) {
    list.push("dispatcher");
  }

  return list.some((g) => {
    if (typeof g !== "string") return false;
    const lower = g.trim().toLowerCase();
    return (
      lower === "dispatcher" ||
      lower === "dispatchers" ||
      lower === "delegados" ||
      lower === "operador" ||
      lower === "admin" ||
      lower === "admin-general" ||
      lower === "admin_general" ||
      lower === "administrador-general"
    );
  });
}

export function isCitizen(user) {
  if (!user) return false;
  const groups = Array.isArray(user.groups)
    ? user.groups
    : typeof user.groups === "string"
    ? [user.groups]
    : [];
  const roles = Array.isArray(user.roles)
    ? user.roles
    : typeof user.roles === "string"
    ? [user.roles]
    : [];
  const role = typeof user.role === "string" ? [user.role] : [];
  const group = typeof user.group === "string" ? [user.group] : [];

  const list = [...groups, ...roles, ...role, ...group];
  return list.some(
    (g) => typeof g === "string" && g.trim().toLowerCase() === "citizen"
  );
}

// TODO(back): grupo `officer` + guards de pantallas de terreno (HU-08/09/10)
export function isOfficer(user) {
  if (!user) return false;
  const groups = Array.isArray(user.groups)
    ? user.groups
    : typeof user.groups === "string"
    ? [user.groups]
    : [];
  const roles = Array.isArray(user.roles)
    ? user.roles
    : typeof user.roles === "string"
    ? [user.roles]
    : [];
  const role = typeof user.role === "string" ? [user.role] : [];
  const group = typeof user.group === "string" ? [user.group] : [];

  const list = [...groups, ...roles, ...role, ...group];
  return list.some(
    (g) => typeof g === "string" && g.trim().toLowerCase() === "officer"
  );
}

export function getHomePathForUser(user) {
  if (isDispatcher(user)) return "/ops";
  return "/inicio";
}
