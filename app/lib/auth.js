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

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(USER_KEY);
}

export { getHomePathForUser, isCitizen, isDispatcher, isOfficer };
