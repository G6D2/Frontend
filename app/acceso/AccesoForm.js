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

// El panel de atajos (llave) mantiene su propio acceso directo al dispatcher.
const DISPATCHER_SHORTCUT = DEMO_LOGIN_SHORTCUTS.find((s) => s.id === "dispatcher");

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

  // Atajos demo sin contraseña (bloque "Demo" debajo de la tarjeta)
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
  // El error va en el bloque Demo porque el de `error` solo se ve en la
  // solapa ciudadana.
  const loginWithDemoShortcut = async (shortcut) => {
    setLoading(true);
    setDemoPendingId(shortcut.id);
    setError("");
    setDemoError("");
    try {
      const { user } = await loginDev({ ...shortcut.account, loginMethod: "sesion" });
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

  // Un solo handler para todos los botones del bloque Demo: el atajo sale del
  // data-shortcut-id. Un closure por botón dentro del .map hace que el lint
  // del React Compiler (react-hooks/immutability) marque el
  // window.location.href de navigateToHome.
  const handleDemoShortcutClick = (event) => {
    const shortcut = DEMO_LOGIN_SHORTCUTS.find(
      (s) => s.id === event.currentTarget.dataset.shortcutId
    );
    if (shortcut) loginWithDemoShortcut(shortcut);
  };

  // Seed V16 — solo relleno de chips de presentación (cuenta pública de demo).
  function fillDemo(account) {
    setEmailHint(account.email);
    setPasswordHint("abracadabra");
    setError("");
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

  const handleLdapModalSubmit = async (e) => {
    e.preventDefault();
    setLdapLoading(true);
    setLdapError("");

    const username = ldapUsername.trim();
    const password = ldapPassword;

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
              <button
                type="button"
                id="tab-acceso-ciudadano"
                onClick={() => switchMode("login")}
                className={`relative z-10 flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isLdap
                    ? "text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MaterialIcon name="person" size={16} />
                <span>Acceso Ciudadano</span>
              </button>
              <button
                type="button"
                id="tab-acceso-ldap"
                onClick={() => switchMode("ldap")}
                className={`relative z-10 flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  isLdap
                    ? "text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MaterialIcon name="vpn_key" size={16} />
                <span>Personal Municipal (LDAP)</span>
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

              {/* Chips de cuentas demo — solo en modo local (AUTH_MODE=local) */}
              {isLogin && !IS_IDP_MODE && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-on-surface-variant w-full">Atajos demo:</span>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillDemo(acc)}
                      className="text-xs px-2.5 py-1 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                    >
                      {acc.preferred_username}
                    </button>
                  ))}
                </div>
              )}

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

                {/* Botón de cuenta ciudadana anónima — solo en modo local */}
                {isLogin && !IS_IDP_MODE && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setError("");
                      try {
                        const { user } = await loginDev({
                          sub: "U000042",
                          preferred_username: "ciudadano",
                          groups: ["citizen"],
                          hasAntipanicButton: false,
                          loginMethod: "anonima",
                        });
                        navigateToHome(user);
                      } catch (err) {
                        setError(
                          err instanceof ApiError
                            ? err.message
                            : "No se pudo conectar con el backend."
                        );
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="min-h-12 py-2.5 px-3 w-full bg-surface-container text-on-surface font-semibold text-xs sm:text-sm tracking-wide rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors flex items-center justify-center text-center gap-2"
                  >
                    <MaterialIcon name="account_balance" className="text-primary shrink-0" size={20} />
                    <span className="hidden sm:inline">Iniciar con cuenta ciudadana</span>
                    <span className="sm:hidden">Cuenta ciudadana</span>
                  </button>
                )}
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

        {/* ── Atajos demo sin contraseña (dispatcher, oficiales y ciudadano con SOS) ──
            Entran con loginDev → POST /auth/dev/login, que el backend solo acepta
            para los sub de su allowlist demo. Ocultos con NEXT_PUBLIC_AUTH_MODE=idp. */}
        {!IS_IDP_MODE && (
          <section aria-labelledby="demo-atajos-titulo" className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-dashed border-outline-variant" />
              </div>
              <div className="relative flex justify-center">
                <h2
                  id="demo-atajos-titulo"
                  className="px-3 bg-background text-xs font-bold tracking-widest uppercase text-amber-800"
                >
                  Demo · entrar sin contraseña
                </h2>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_LOGIN_SHORTCUTS.map((shortcut) => (
                <button
                  key={shortcut.id}
                  id={`btn-demo-${shortcut.id}`}
                  data-shortcut-id={shortcut.id}
                  type="button"
                  disabled={loading || ldapLoading}
                  onClick={handleDemoShortcutClick}
                  className="min-h-14 p-2.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 hover:shadow-sm transition-all flex items-center gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-default"
                >
                  <MaterialIcon name={shortcut.icon} size={20} className="text-amber-800 shrink-0" />
                  <span className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-amber-950 leading-tight">
                      {demoPendingId === shortcut.id ? "Ingresando..." : shortcut.label}
                    </span>
                    <span className="text-[11px] font-mono text-amber-900/80 truncate">
                      {shortcut.account.sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {demoError && (
              <div role="alert" className="mt-2 p-3 rounded-lg bg-error-container text-on-error-container text-sm">
                {demoError}
              </div>
            )}
          </section>
        )}

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
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {/* Atajo 1: Juan Dispatcher */}
              <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="badge" size={18} className="text-primary" />
                    <span className="font-bold text-sm text-primary">Juan Dispatcher</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-on-primary">
                    LDAP
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant flex flex-col gap-1 bg-surface-container-lowest p-2.5 rounded-lg font-mono border border-outline-variant/60">
                  <div><span className="font-semibold text-on-surface font-sans">usuario:</span> juan-trabaja</div>
                  <div><span className="font-semibold text-on-surface font-sans">contraseña:</span> trabaja123</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    switchMode("ldap");
                    setLdapUsername("juan-trabaja");
                    setLdapPassword("trabaja123");
                    setLdapError("");
                    setShortcutFeedback("Credenciales de juan-trabaja cargadas ✓");
                    setTimeout(() => {
                      setShortcutsOpen(false);
                      setShortcutFeedback("");
                    }, 350);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MaterialIcon name="login" size={16} />
                  <span>Cargar credenciales</span>
                </button>
              </div>

              {/* Atajo 2: Delegado Municipal */}
              <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="admin_panel_settings" size={18} className="text-purple-800" />
                    <span className="font-bold text-sm text-primary">Delegado Municipal</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-800 text-white">
                    LDAP Admin
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant flex flex-col gap-1 bg-surface-container-lowest p-2.5 rounded-lg font-mono border border-outline-variant/60">
                  <div><span className="font-semibold text-on-surface font-sans">usuario:</span> delegado-emer</div>
                  <div><span className="font-semibold text-on-surface font-sans">contraseña:</span> changeit123</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    switchMode("ldap");
                    setLdapUsername("delegado-emer");
                    setLdapPassword("changeit123");
                    setLdapError("");
                    setShortcutFeedback("Credenciales de delegado cargadas ✓");
                    setTimeout(() => {
                      setShortcutsOpen(false);
                      setShortcutFeedback("");
                    }, 350);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MaterialIcon name="login" size={16} />
                  <span>Cargar credenciales</span>
                </button>
              </div>

              {/* Atajo 3: Juan Pánico (Ciudadano) */}
              <div className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary transition-all flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="emergency" size={18} className="text-red-600" />
                    <span className="font-bold text-sm text-primary">Juan Pánico</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-primary border border-outline-variant">
                    Ciudadano
                  </span>
                </div>
                <div className="text-xs text-on-surface-variant flex flex-col gap-1 bg-surface-container-lowest p-2.5 rounded-lg font-mono border border-outline-variant/60">
                  <div><span className="font-semibold text-on-surface font-sans">Email:</span> juanpanico@gmail.com</div>
                  <div><span className="font-semibold text-on-surface font-sans">contraseña:</span> abracadabra</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    switchMode("login");
                    setEmailHint("juanpanico@gmail.com");
                    setPasswordHint("abracadabra");
                    setError("");
                    setShortcutFeedback("Credenciales de Juan Pánico cargadas ✓");
                    setTimeout(() => {
                      setShortcutsOpen(false);
                      setShortcutFeedback("");
                    }, 350);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-outline-variant"
                >
                  <MaterialIcon name="login" size={16} />
                  <span>Cargar credenciales</span>
                </button>
              </div>

              {/* Atajo 4: Dispatcher Demo Bypass (Local) */}
              {!IS_IDP_MODE && (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-950">Acceso Directo Demo</span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                      Bypass
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/80">
                    Entrada inmediata a la vista operativa sin credenciales (modo local).
                  </p>
                  <button
                    type="button"
                    disabled={loading || ldapLoading}
                    onClick={() => {
                      setShortcutsOpen(false);
                      loginWithDemoShortcut(DISPATCHER_SHORTCUT);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <MaterialIcon name="bolt" size={16} />
                    <span>Ingresar a Dispatcher View</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
