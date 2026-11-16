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

/**
 * Guarda solo claims de sesión (sin email ni otros PII).
 *
 * Es una copia de conveniencia: la sesión real es la cookie httpOnly. Si el
 * navegador bloquea o tiene lleno el storage (setItem y hasta el acceso a
 * `sessionStorage` pueden tirar), se sigue sin la copia en vez de romper el
 * login o la carga del usuario, que ya salieron bien.
 */
export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  try {
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
  } catch {
    // Sin storage no hay copia local: getStoredUser() devuelve null.
  }
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(USER_KEY);
  } catch {
    // Sin storage no hay nada que borrar.
  }
}

export { getHomePathForUser, isDispatcher, isOfficer } from "./auth-roles";
