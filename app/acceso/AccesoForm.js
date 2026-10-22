"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MaterialIcon from "../components/civic/MaterialIcon";
import { loginDev, loginWithPassword, registerAccount, ApiError, getHomePathForUser } from "../lib/api";
import { DEMO_ACCOUNTS, DISPATCHER_DEMO } from "../lib/features";

// En modo idp real, se ocultan los atajos demo (el IdP no los admite).
const IS_IDP_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "idp";
const IDP_LOGIN_URL = process.env.NEXT_PUBLIC_IDP_LOGIN_URL || "";

// ── Modo: "login" | "signup" | "forgot"
export default function AccesoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState(
    searchParams.get("signup") === "1" ? "signup" : "login"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [emailHint, setEmailHint] = useState("");
  const [passwordHint, setPasswordHint] = useState("");

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  function switchMode(next) {
    setMode(next);
    setError("");
    setForgotSent(false);
  }

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
        router.replace(getHomePathForUser(user));
      } else {
        const { user } = await loginWithPassword({ email, password });
        router.replace(getHomePathForUser(user));
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

  const handleForgot = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.forgotIdentifier?.value?.trim() || "";
    // Llama al endpoint BFF (mock por ahora). TODO(back): activar cuando HU-12 este listo.
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // silenciar — siempre mostramos el estado de "enviado" (no revela si el email existe)
    }
    setForgotSent(true);

  };

  const iconName = isForgot ? "lock_reset" : isSignup ? "person_add" : "security";
  const title = isForgot ? "Recuperar contraseña" : isSignup ? "Crear cuenta" : "Bienvenido";
  const subtitle = isForgot
    ? "Ingresá tu CUIL o correo y te enviamos el enlace de recuperación."
    : isSignup
    ? "Creá tu cuenta ciudadana para guardar datos y preferencias."
    : "Acceso seguro a los servicios de la ciudad.";

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4 md:p-12">
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-xl p-6 md:p-8 flex flex-col gap-8">

          {/* Header */}
          <div className="text-center flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-primary text-5xl bg-surface-container rounded-full p-4">
              {iconName}
            </span>
            <div>
              <h1 className="text-2xl md:text-[32px] font-bold text-primary leading-tight">
                CityPass<span style={{ color: "rgb(210, 152, 63)" }}>+</span>
              </h1>
              <p className="text-base font-semibold text-on-surface mt-1">{title}</p>
              <p className="text-sm text-on-surface-variant mt-1 max-w-xs mx-auto leading-snug">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Formulario login / signup */}
          {!isForgot && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* Correo o Usuario LDAP */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="identifier" className="text-sm font-semibold tracking-wide text-on-surface">
                  {IS_IDP_MODE ? "Usuario o Correo (LDAP)" : "Correo electrónico"}
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type={IS_IDP_MODE ? "text" : "email"}
                  placeholder={IS_IDP_MODE ? "ej: juan-labura o delegado-emer" : "vos@correo.com"}
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
                        router.replace(getHomePathForUser(user));
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

          {/* Flujo: Olvidé mi contraseña */}
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

        {/* ── Bloque inferior: Demo Dispatcher (local) o Acceso institucional (idp) ── */}
        <div className="mt-4">
          {IS_IDP_MODE ? (
            /* Modo IdP real — enlace al portal del Grupo 2 */
            IDP_LOGIN_URL ? (
              <a
                href={IDP_LOGIN_URL}
                className="mt-4 w-full group relative overflow-hidden rounded-xl border-2 border-dashed p-4 flex items-center gap-4 transition-all hover:shadow-md"
                style={{
                  borderColor: "rgb(59, 130, 246)",
                  backgroundColor: "rgba(59, 130, 246, 0.05)",
                  textDecoration: "none",
                }}
              >
                <div
                  className="shrink-0 rounded-lg p-2.5 flex items-center justify-center"
                  style={{ backgroundColor: "rgba(59, 130, 246, 0.12)" }}
                >
                  <span
                    className="material-symbols-outlined material-icon"
                    style={{ fontSize: 28, color: "rgb(37, 99, 235)", fontVariationSettings: "'FILL' 0" }}
                  >
                    vpn_key
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: "rgb(29, 78, 216)" }}>
                      Acceso institucional
                    </span>
                    <span
                      className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: "rgb(29, 78, 216)",
                        backgroundColor: "rgba(59, 130, 246, 0.18)",
                      }}
                    >
                      Login Federado
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgb(59, 130, 246)" }}>
                    Ingresá con tu cuenta del IdP CityPass+
                  </p>
                </div>
                <span
                  className="material-symbols-outlined material-icon shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ fontSize: 20, color: "rgb(37, 99, 235)", fontVariationSettings: "'FILL' 0" }}
                >
                  open_in_new
                </span>
              </a>
            ) : null
          ) : (
            /* Modo local — botón Demo Dispatcher */
            <>
              <div className="relative">
                {/* Línea divisoria con etiqueta DEMO */}
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-dashed border-outline-variant" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-background text-xs font-bold tracking-widest uppercase"
                    style={{ color: "rgb(180, 120, 20)" }}>
                    Demo
                  </span>
                </div>
              </div>

              <button
                id="btn-dispatcher-demo"
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    const { user } = await loginDev({
                      ...DISPATCHER_DEMO,
                      loginMethod: "sesion",
                    });
                    router.replace(getHomePathForUser(user));
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
                className="mt-4 w-full group relative overflow-hidden rounded-xl border-2 border-dashed p-4 flex items-center gap-4 transition-all hover:shadow-md disabled:opacity-60"
                style={{
                  borderColor: "rgb(210, 152, 63)",
                  backgroundColor: "rgba(210, 152, 63, 0.06)",
                }}
              >
                {/* Ícono */}
                <div
                  className="shrink-0 rounded-lg p-2.5 flex items-center justify-center"
                  style={{ backgroundColor: "rgba(210, 152, 63, 0.15)" }}
                >
                  <span
                    className="material-symbols-outlined material-icon"
                    style={{ fontSize: 28, color: "rgb(180, 120, 20)", fontVariationSettings: "'FILL' 0" }}
                  >
                    radio_button_checked
                  </span>
                </div>

                {/* Texto */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: "rgb(130, 80, 10)" }}>
                      Vista Dispatcher
                    </span>
                    <span
                      className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: "rgb(130, 80, 10)",
                        backgroundColor: "rgba(210, 152, 63, 0.25)",
                      }}
                    >
                      Demo
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgb(160, 110, 30)" }}>
                    Acceso directo al panel de control de emergencias
                  </p>
                </div>

                {/* Flecha */}
                <span
                  className="material-symbols-outlined material-icon shrink-0 transition-transform group-hover:translate-x-1"
                  style={{ fontSize: 20, color: "rgb(180, 120, 20)", fontVariationSettings: "'FILL' 0" }}
                >
                  arrow_forward
                </span>
              </button>
            </>
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
    </div>
  );
}

