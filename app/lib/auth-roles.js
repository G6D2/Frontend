/** Helpers de rol (sin I/O). Usables en server y client. */

export function isDispatcher(user) {
  return Array.isArray(user?.groups) && user.groups.includes("dispatcher");
}

export function isCitizen(user) {
  return Array.isArray(user?.groups) && user.groups.includes("citizen");
}

// TODO(back): grupo `officer` + guards de pantallas de terreno (HU-08/09/10)
export function isOfficer(user) {
  return Array.isArray(user?.groups) && user.groups.includes("officer");
}

export function getHomePathForUser(user) {
  if (isDispatcher(user)) return "/ops";
  return "/inicio";
}
