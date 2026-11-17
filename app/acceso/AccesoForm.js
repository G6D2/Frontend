"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MaterialIcon from "../components/civic/MaterialIcon";
import {
  loginDev,
  loginWithPassword,
  loginWithLdap,
  registerAccount,
  ApiError,
  getHomePathForUser,
} from "../lib/api";
import { DEMO_ACCOUNTS, DEMO_LOGIN_SHORTCUTS } from "../lib/features";

// En modo idp real, se ocultan los atajos demo (el IdP no los admite).
const IS_IDP_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "idp";

// Todos los atajos de prueba viven en el panel de la llave (a la derecha de
// la tarjeta). La tarjeta queda solo con los formularios.

// Ciudadano sin perfil (sub U000042 de la allowlist demo del backend). Entra
// por loginDev como el resto de los atajos sin contraseña, con su propio
// loginMethod para que la sesión se vea como anónima.
const ANONYMOUS_CITIZEN_SHORTCUT = Object.freeze({
  id: "ciudadano-anonimo",
  label: "Ciudadano anónimo",
  icon: "account_balance",
  loginMethod: "anonima",
  account: Object.freeze({
    sub: "U000042",
    preferred_username: "ciudadano",
    groups: ["citizen"],
    hasAntipanicButton: false,
  }),
});

const PANEL_DEMO_SHORTCUTS = [...DEMO_LOGIN_SHORTCUTS, ANONYMOUS_CITIZEN_SHORTCUT];

// Usuarios de prueba del LDAP del Grupo 2 (Login Federado). El atajo carga
// solo el usuario: la contraseña no viaja en el bundle de JS y la escribe
// quien entra. Con una contraseña acá, cualquiera con la URL entraba como
// dispatcher en dos clics.
const LDAP_DEMO_USERS = Object.freeze([
  Object.freeze({
    username: "juan-trabaja",
    label: "Juan Dispatcher",
    badge: "LDAP",
    icon: "badge",
  }),
  Object.freeze({
    username: "delegado-emer",
    label: "Delegado Municipal",
    badge: "LDAP Admin",
    icon: "admin_panel_settings",
  }),
]);

// Botón de acción de cada fila del panel: mismo ancho en las tres secciones.
// El `!` hace falta por el `font: inherit` de @mantine/core/styles.css.
const SHORTCUT_ACTION_CLASS =
  "shrink-0 w-20 py-2 px-1.5 rounded-lg bg-primary text-on-primary text-xs! font-semibold! hover:opacity-90 transition-opacity flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-default";

const iconClassFor = (hasAntipanicButton) => (hasAntipanicButton ? "text-red-600" : "text-primary");

// Una fila del panel de la llave: la misma tarjeta para las tres secciones.
function ShortcutRow({ icon, iconClassName, title, detail, badge, action }) {
  return (
    <div className="p-3 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex items-center gap-3 shadow-xs">
      <span className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
        <MaterialIcon name={icon} size={20} className={iconClassName || "text-primary"} />
      </span>
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span className="font-bold text-sm text-primary truncate">{title}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-mono text-on-surface-variant truncate">{detail}</span>
          {badge && (
            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-primary/10 text-primary border border-primary/20">
              {badge}
            </span>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// Una sección del panel: título, filas y una línea que dice qué hace el botón.
function ShortcutSection({ id, title, hint, children }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-[11px] font-bold tracking-widest uppercase text-primary">
        {title}
      </h3>
      {children}
      {hint && <p className="text-[11px] text-on-surface-variant leading-snug">{hint}</p>}
    </section>
  );
}

// ── Modo: "login" | "signup" | "forgot"
export default function AccesoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState(() => {
    if (searchParams.get("signup") === "1") return "signup";
    return "login";
  });

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [emailHint, setEmailHint] = useState("");
  const [passwordHint, setPasswordHint] = useState("");

  // Estado del formulario de LDAP
  const [ldapUsername, setLdapUsername] = useState("");
  const [ldapPassword, setLdapPassword] = useState("");
  const [showLdapPassword, setShowLdapPassword] = useState(false);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [ldapError, setLdapError] = useState("");

  // Atajos demo sin contraseña (sección del panel de la llave)
  const [demoPendingId, setDemoPendingId] = useState(null);
  const [demoError, setDemoError] = useState("");

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isLdap = mode === "ldap";

  function switchMode(next) {
    setMode(next);
    setError("");
    setLdapError("");
    setDemoError("");
    setForgotSent(false);
  }

  function navigateToHome(user) {
    const target = getHomePathForUser(user);
    if (typeof target === "string" && (target.startsWith("http://") || target.startsWith("https://"))) {
      window.location.href = target;
    } else {
      router.replace(target);
    }
  }

  // Atajo demo: loginDev (POST /auth/dev/login con el sub) y home según el rol.
  // El error va en el panel, al lado del botón, porque el de `error` solo se
  // ve en la solapa ciudadana.
  const loginWithDemoShortcut = async (shortcut) => {
    setLoading(true);
    setDemoPendingId(shortcut.id);
    setError("");
    setDemoError("");
    try {
      const { user } = await loginDev({
        ...shortcut.account,
        loginMethod: shortcut.loginMethod || "sesion",
      });
      navigateToHome(user);
    } catch (err) {
      setDemoError(
        err instanceof ApiError ? err.message : "No se pudo conectar con el backend."
      );
    } finally {
      setLoading(false);
      setDemoPendingId(null);
    }
  };

  // Un solo handler para todos los botones sin contraseña del panel: el atajo
  // sale del data-shortcut-id. Un closure por botón dentro del .map hace que
  // el lint del React Compiler (react-hooks/immutability) marque el
  // window.location.href de navigateToHome.
  const handleDemoShortcutClick = (event) => {
    const shortcut = PANEL_DEMO_SHORTCUTS.find(
      (s) => s.id === event.currentTarget.dataset.shortcutId
    );
    if (shortcut) loginWithDemoShortcut(shortcut);
  };

  // Después de cargar un atajo: aviso breve en el panel y lo cierra.
  function confirmShortcut(message, focusId) {
    setShortcutFeedback(message);
    setTimeout(() => {
      setShortcutsOpen(false);
      setShortcutFeedback("");
      if (focusId) document.getElementById(focusId)?.focus();
    }, 350);
  }

  // Seed V16 — cuentas ciudadanas públicas de demo: completa email y contraseña.
  function fillDemo(account) {
    switchMode("login");
    setEmailHint(account.email);
    setPasswordHint("abracadabra");
    confirmShortcut(`Credenciales de ${account.preferred_username} cargadas ✓`);
  }

  // Usuario LDAP de prueba: completa solo el usuario en la solapa Personal y
  // deja el foco en la contraseña, que se escribe.
  function fillLdapUser(ldapUser) {
    switchMode("ldap");
    setLdapUsername(ldapUser.username);
    setLdapPassword("");
    confirmShortcut(`Usuario ${ldapUser.username} cargado: escribí la contraseña ✓`, "card-ldap-password");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.target;
    const email = (form.identifier?.value || "").trim();
    const password = form.password?.value || "";

    try {
      if (isSignup) {
        const { user } = await registerAccount({
          email,
          password,
          preferred_username: email.split("@")[0],
        });
        navigateToHome(user);
      } else {
        const { user } = await loginWithPassword({ email, password });
        navigateToHome(user);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el backend. ¿Está corriendo en el puerto 3000?"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLdapModalSubmit = (e) => {
    e.preventDefault();
    submitLdapLogin(ldapUsername.trim(), ldapPassword);
  };

  const submitLdapLogin = async (username, password) => {
    setLdapLoading(true);
    setLdapError("");

    try {
      const { user } = await loginWithLdap({ username, password });
      navigateToHome(user);
    } catch (err) {
      setLdapError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor de Login Federado (LDAP)."
      );
    } finally {
      setLdapLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.forgotIdentifier?.value?.trim() || "";
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // silenciar — siempre mostramos el estado de "enviado"
    }
    setForgotSent(true);
  };

  const iconName = isLdap
    ? "vpn_key"
    : isForgot
    ? "lock_reset"
    : isSignup
    ? "person_add"
    : "security";

  const title = isLdap
    ? "Ingreso Personal (LDAP)"
    : isForgot
    ? "Recuperar contraseña"
    : isSignup
    ? "Crear cuenta"
    : "Bienvenido";

  const subtitle = isLdap
    ? "Acceso institucional para operadores de emergencias, dispatchers y delegados."
    : isForgot
    ? "Ingresá tu CUIL o correo y te enviamos el enlace de recuperación."
    : isSignup
    ? "Creá tu cuenta ciudadana para guardar datos y preferencias."
    : "Acceso seguro a los servicios de la ciudad.";

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4 pr-12 md:p-12 relative">
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-xl p-6 md:p-8 flex flex-col gap-6 relative">

          {/* Pestaña pegada al lateral derecho de glass-card: solo la llave */}
          <button
            type="button"
            id="btn-solapa-atajos"
            aria-label="Atajos de credenciales"
            title="Atajos de prueba"
            onClick={() => setShortcutsOpen(true)}
            className="absolute left-full top-24 -translate-y-1/2 -ml-[1px] z-30 w-10 h-12 rounded-r-xl rounded-l-none bg-primary text-on-primary shadow-md hover:bg-primary-container transition-all flex items-center justify-center cursor-pointer group hover:w-11"
          >
            <MaterialIcon name="vpn_key" size={20} className="text-on-primary group-hover:scale-110 transition-transform" />
          </button>

          {/* Header */}
          <div className="text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-5xl rounded-full p-4 text-primary bg-surface-container">
              {iconName}
            </span>
            <div>
              <h1 className="text-2xl md:text-[32px] font-bold text-primary leading-tight">
                CityPass<span style={{ color: "rgb(210, 152, 63)" }}>+</span>
              </h1>
              <div className="flex items-center justify-center gap-2 mt-1">
                <p className="text-base font-semibold text-on-surface">{title}</p>
                {isLdap && (
                  <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    LDAP
                  </span>
                )}
              </div>
              <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-snug">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Selector de Solapa: Acceso Ciudadano vs Personal Municipal (LDAP) */}
          {!isForgot && (
            <div className="relative flex p-1 rounded-xl bg-surface-container border border-outline-variant/60 overflow-hidden">
              {/* Indicador animado deslizante con animación de recorrido */}
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
                style={{
                  transform: isLdap ? "translateX(calc(100%))" : "translateX(0%)",
                }}
              />
              {/* Una sola línea por solapa: el texto largo se abrevia en
                  pantallas chicas en vez de partirse en dos renglones.
                  El `!` del tamaño y el peso hace falta porque
                  @mantine/core/styles.css (sin capa) pone `font: inherit` en
                  los botones y le gana a las utilidades de Tailwind. */}
              <button
                type="button"
                id="tab-acceso-ciudadano"
                onClick={() => switchMode("login")}
                className={`relative z-10 flex-1 min-w-0 py-2.5 px-1.5 rounded-lg text-[11px]! font-bold! whitespace-nowrap transition-colors duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                  !isLdap
                    ? "text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MaterialIcon name="person" size={14} className="shrink-0" />
                <span className="truncate">Acceso Ciudadano</span>
              </button>
              <button
                type="button"
                id="tab-acceso-ldap"
                onClick={() => switchMode("ldap")}
                className={`relative z-10 flex-1 min-w-0 py-2.5 px-1.5 rounded-lg text-[11px]! font-bold! whitespace-nowrap transition-colors duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                  isLdap
                    ? "text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MaterialIcon name="vpn_key" size={14} className="shrink-0" />
                <span className="truncate sm:hidden">Personal (LDAP)</span>
                <span className="truncate hidden sm:inline">Personal Municipal (LDAP)</span>
              </button>
            </div>
          )}

          {/* ── Flujo 1: Personal Municipal (LDAP) ── */}
          {isLdap && (
            <form key="form-ldap" onSubmit={handleLdapModalSubmit} className="animate-form-fade flex flex-col gap-4">

              {/* Usuario */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-ldap-username" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Usuario LDAP / Correo institucional
                </label>
                <input
                  id="card-ldap-username"
                  name="username"
                  type="text"
                  placeholder="ej: juan-trabaja o delegado-emer"
                  value={ldapUsername}
                  onChange={(e) => setLdapUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="h-11 px-3.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                />
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-ldap-password" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="card-ldap-password"
                    name="password"
                    type={showLdapPassword ? "text" : "password"}
                    placeholder="Contraseña institucional"
                    value={ldapPassword}
                    onChange={(e) => setLdapPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-11 w-full pl-3.5 pr-11 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                  />
                  <button
                    type="button"
                    aria-label={showLdapPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowLdapPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 transition-colors"
                  >
                    <MaterialIcon name={showLdapPassword ? "visibility_off" : "visibility"} size={18} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {ldapError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <MaterialIcon name="error" size={16} className="text-red-600 shrink-0" />
                  <span>{ldapError}</span>
                </div>
              )}

              {/* Botón Submit (Azul Náutico - color primario) */}
              <button
                id="btn-card-ldap-submit"
                type="submit"
                disabled={ldapLoading}
                className="min-h-[52px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm cursor-pointer"
              >
                {ldapLoading ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Autenticando con LDAP...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar a Dispatcher View</span>
                    <MaterialIcon name="arrow_forward" size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Flujo 2: Ciudadano (Login / Signup) ── */}
          {!isForgot && !isLdap && (
            <form key={`form-${mode}`} onSubmit={handleSubmit} className="animate-form-fade flex flex-col gap-5">

              {/* Correo */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="identifier" className="text-sm font-semibold tracking-wide text-on-surface">
                  Correo electrónico
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="email"
                  placeholder="vos@correo.com"
                  key={`${mode}-${emailHint}`}
                  defaultValue={emailHint}
                  autoComplete="username"
                  required
                  className="h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all text-sm"
                />
              </div>

              {/* Contraseña */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold tracking-wide text-on-surface">
                    Contraseña
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isSignup ? "Mínimo 8 caracteres" : "Tu contraseña"}
                    key={`pw-${mode}-${passwordHint}`}
                    defaultValue={passwordHint}
                    minLength={isSignup ? 8 : undefined}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                    className="h-12 w-full pl-4 pr-12 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all text-sm"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[52px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading
                    ? isSignup ? "Creando cuenta..." : "Ingresando..."
                    : isSignup ? "Registrarme" : "Iniciar sesión"}
                  <MaterialIcon name={isSignup ? "person_add" : "arrow_forward"} />
                </button>
              </div>

              {/* Alternancia login ↔ signup */}
              <p className="text-center text-sm text-on-surface-variant">
                {isSignup ? (
                  <>
                    ¿Ya tenés cuenta?{" "}
                    <button type="button" onClick={() => switchMode("login")} className="font-semibold text-primary hover:underline">
                      Iniciar sesión
                    </button>
                  </>
                ) : (
                  <>
                    ¿No tenés cuenta?{" "}
                    <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-primary hover:underline">
                      Registrate
                    </button>
                  </>
                )}
              </p>
            </form>
          )}

          {/* ── Flujo 3: Olvidé mi contraseña ── */}
          {isForgot && (
            <div className="flex flex-col gap-5">
              {forgotSent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <span className="material-symbols-outlined text-5xl text-on-primary-container bg-surface-container rounded-full p-4">
                    mark_email_read
                  </span>
                  <div>
                    <p className="font-semibold text-on-surface">¡Enlace enviado!</p>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Si el CUIL o correo está registrado, recibirás el enlace en breve.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mt-2 text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <MaterialIcon name="arrow_back" size={16} />
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="forgot-identifier" className="text-sm font-semibold tracking-wide text-on-surface">
                      CUIL o correo electrónico
                    </label>
                    <input
                      id="forgot-identifier"
                      name="forgotIdentifier"
                      type="text"
                      placeholder="20-12345678-9 o vos@correo.com"
                      required
                      className="h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="flex items-center justify-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface font-medium transition-colors min-h-[44px] order-2 sm:order-1"
                    >
                      <MaterialIcon name="arrow_back" size={16} />
                      Volver al login
                    </button>
                    <button
                      type="submit"
                      className="order-1 sm:order-2 min-h-[44px] px-5 bg-primary text-on-primary font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      Enviar enlace
                      <MaterialIcon name="send" size={18} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="text-xs font-medium text-on-surface-variant flex items-center justify-center gap-1">
            <MaterialIcon name="lock" size={14} />
            Sesión en cookie httpOnly (BFF Next.js)
          </p>
        </div>
      </div>

      {/* Modal / Panel lateral de Atajos */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer"
            onClick={() => setShortcutsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel lateral deslizante */}
          <aside
            id="drawer-atajos"
            aria-label="Panel de atajos"
            className="fixed top-0 bottom-0 right-0 z-50 w-full max-w-xs sm:max-w-sm bg-surface-container-lowest border-l border-outline-variant shadow-2xl flex flex-col animate-drawer-slide"
          >
            {/* Header */}
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <MaterialIcon name="vpn_key" size={18} className="text-on-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-primary leading-tight">Atajos</h2>
                  <p className="text-[11px] text-on-surface-variant">Credenciales de prueba</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                aria-label="Cerrar panel de atajos"
              >
                <MaterialIcon name="close" size={20} />
              </button>
            </div>

            {/* Feedback visual */}
            {shortcutFeedback && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-green-50 border border-green-200 text-green-900 text-xs font-semibold flex items-center gap-2">
                <MaterialIcon name="check_circle" size={16} className="text-green-600 shrink-0" />
                <span>{shortcutFeedback}</span>
              </div>
            )}

            {/* Lista de Atajos */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
              {/* 1. Sin contraseña: loginDev → POST /auth/dev/login, que el
                  backend solo acepta para los sub de su allowlist demo.
                  Ocultos con NEXT_PUBLIC_AUTH_MODE=idp. */}
              {!IS_IDP_MODE && (
                <ShortcutSection
                  id="atajos-sin-contrasena"
                  title="Entrar sin contraseña · demo"
                  hint="Entra directo con el login de demo, sin pasar por el formulario."
                >
                  {PANEL_DEMO_SHORTCUTS.map((shortcut) => (
                    <ShortcutRow
                      key={shortcut.id}
                      icon={shortcut.icon}
                      iconClassName={iconClassFor(shortcut.account.hasAntipanicButton)}
                      title={shortcut.label}
                      detail={shortcut.account.sub}
                      action={
                        <button
                          id={`btn-demo-${shortcut.id}`}
                          data-shortcut-id={shortcut.id}
                          type="button"
                          disabled={loading || ldapLoading}
                          onClick={handleDemoShortcutClick}
                          className={SHORTCUT_ACTION_CLASS}
                        >
                          {demoPendingId === shortcut.id ? (
                            <span>Entrando…</span>
                          ) : (
                            <>
                              <MaterialIcon name="bolt" size={16} />
                              <span>Entrar</span>
                            </>
                          )}
                        </button>
                      }
                    />
                  ))}
                  {demoError && (
                    <div role="alert" className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
                      {demoError}
                    </div>
                  )}
                </ShortcutSection>
              )}

              {/* 2. Personal municipal (LDAP): carga usuario y contraseña. */}
              <ShortcutSection
                id="atajos-ldap"
                title="Personal municipal (LDAP)"
                hint="Carga el usuario en la solapa Personal; la contraseña la escribís vos."
              >
                {LDAP_DEMO_USERS.map((ldapUser) => (
                  <ShortcutRow
                    key={ldapUser.username}
                    icon={ldapUser.icon}
                    title={ldapUser.label}
                    detail={ldapUser.username}
                    badge={ldapUser.badge}
                    action={
                      <button
                        id={`btn-ldap-${ldapUser.username}`}
                        type="button"
                        disabled={loading || ldapLoading}
                        onClick={() => fillLdapUser(ldapUser)}
                        className={SHORTCUT_ACTION_CLASS}
                      >
                        <MaterialIcon name="login" size={16} />
                        <span>Cargar</span>
                      </button>
                    }
                  />
                ))}
              </ShortcutSection>

              {/* 3. Cuentas ciudadanas del seed V16 (públicas de demo). */}
              {!IS_IDP_MODE && (
                <ShortcutSection
                  id="atajos-ciudadanos"
                  title="Cuentas ciudadanas"
                  hint="Carga email y contraseña en Acceso Ciudadano; después tocá Iniciar sesión."
                >
                  {DEMO_ACCOUNTS.map((account) => (
                    <ShortcutRow
                      key={account.email}
                      icon={account.hasAntipanicButton ? "emergency" : "person"}
                      iconClassName={iconClassFor(account.hasAntipanicButton)}
                      title={account.preferred_username}
                      detail={account.email}
                      action={
                        <button
                          id={`btn-ciudadano-${account.sub}`}
                          type="button"
                          disabled={loading || ldapLoading}
                          onClick={() => fillDemo(account)}
                          className={SHORTCUT_ACTION_CLASS}
                        >
                          <MaterialIcon name="login" size={16} />
                          <span>Cargar</span>
                        </button>
                      }
                    />
                  ))}
                </ShortcutSection>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
