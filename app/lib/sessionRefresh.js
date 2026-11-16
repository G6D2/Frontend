/**
 * Lógica de SessionRefreshManager: cuándo pedir POST /api/auth/refresh y qué
 * hacer con la respuesta. Sin React ni DOM (como sosController.js): el
 * componente le pasa el fetch y conecta el timer y la vuelta a la pestaña.
 *
 * Quién decide si la sesión es federada: el server. El browser no puede leer
 * las cookies httpOnly, y la única señal confiable es la cookie
 * `citypass_refresh`, que existe solo si el login vino del IdP (el login local
 * la borra; ver app/api/auth/login/route.js). Un marcador del lado del cliente
 * (`loginMethod` en sessionStorage) no sirve: no existe en una pestaña nueva y
 * puede quedar viejo si otra pestaña se loguea con otro método.
 *
 * Reglas:
 * - `no_refresh_token` → sesión local (atajos demo, email/contraseña): no se
 *   vuelve a pedir refresh hasta pasar otra vez por /acceso (`reset`).
 * - Refresh fallido con `sessionActive: true` → no se redirige: el access
 *   token actual sigue sirviendo hasta su `exp`.
 * - `sessionActive: false` → el token ya venció: `onExpired` (→ /acceso).
 * - Después de cada intento, salga como salga, se anota la hora: la vuelta a
 *   la pestaña no reintenta hasta que pase otro intervalo.
 * - En las pantallas de autenticación (`isAuthScreen`) no se refresca. El
 *   componente monta el timer una sola vez, no por navegación, y en cada
 *   disparo pasa la ruta en la que está el usuario.
 */

// Con expires_in = 900 s (15 min), renovar a los ~13 minutos según la guía oficial LDAP.
export const SESSION_REFRESH_INTERVAL_MS = 13 * 60 * 1000;

/** Pantallas de autenticación: ahí no hay sesión que refrescar. */
export function isAuthScreen(pathname) {
  return pathname === "/acceso" || pathname === "/logout";
}

/**
 * @param {object} deps
 * @param {() => Promise<Response>} deps.refresh POST /api/auth/refresh.
 * @param {() => void} deps.onExpired Se llama cuando el server dice que el token venció.
 * @param {() => number} [deps.now]
 * @param {number} [deps.intervalMs]
 */
export function createSessionRefresher({
  refresh,
  onExpired,
  now = () => Date.now(),
  intervalMs = SESSION_REFRESH_INTERVAL_MS,
}) {
  let lastAttemptAt = now();
  let inFlight = false;
  let localSession = false;

  async function attempt(pathname) {
    if (isAuthScreen(pathname) || localSession || inFlight) return "skipped";
    inFlight = true;
    try {
      let res;
      try {
        res = await refresh();
      } catch {
        return "kept"; // red caída: se reintenta en el próximo intervalo
      }
      if (res.ok) return "refreshed";

      const body = await res.json().catch(() => null);
      if (body?.reason === "no_refresh_token") localSession = true;
      if (body?.sessionActive === false) {
        onExpired();
        return "expired";
      }
      return localSession ? "local" : "kept";
    } finally {
      lastAttemptAt = now();
      inFlight = false;
    }
  }

  return {
    /** Timer periódico. `pathname`: ruta actual (en las de autenticación no refresca). */
    tick: attempt,
    /** La pestaña volvió a primer plano: solo intenta si ya pasó un intervalo. */
    onVisible(pathname) {
      if (now() - lastAttemptAt < intervalMs) return Promise.resolve("skipped");
      return attempt(pathname);
    },
    /** En /acceso: la próxima sesión puede ser federada o local. */
    reset() {
      localSession = false;
      lastAttemptAt = now();
    },
    isLocalSession: () => localSession,
  };
}
