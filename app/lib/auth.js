import { getHomePathForUser, isCitizen, isDispatcher, isOfficer } from "./auth-roles";

const USER_KEY = "citypass_user_profile";

/** Perfil no sensible en sessionStorage (el JWT vive en cookie httpOnly). */
export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Guarda solo claims de sesión (sin email ni otros PII). */
export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  const {
    sub,
    username,
    preferred_username,
    groups,
    hasAntipanicButton,
    loginMethod,
  } = user;
  sessionStorage.setItem(
    USER_KEY,
    JSON.stringify({
      sub,
      username: username || preferred_username,
      groups: Array.isArray(groups) ? groups : [],
      hasAntipanicButton: Boolean(hasAntipanicButton),
      ...(loginMethod ? { loginMethod } : {}),
    })
  );
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(USER_KEY);
}

export { getHomePathForUser, isCitizen, isDispatcher, isOfficer };
