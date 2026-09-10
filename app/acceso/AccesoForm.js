"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MaterialIcon from "../components/civic/MaterialIcon";
import { loginDev, ApiError, getHomePathForUser } from "../lib/api";
import { ANTIPANIC_MODE } from "../lib/features";

export default function AccesoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("citizen");
  const [mode, setMode] = useState(
    searchParams.get("signup") === "1" ? "signup" : "login"
  ); // "login" | "signup"
  const [hasAntipanicButton, setHasAntipanicButton] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.target;
    const username = (form.email.value || "ciudadano").trim();
    // TODO(back): rol real viene del IdP — selector solo para AUTH_MODE=local
    // Sign up es solo ciudadano (mock); el IdP real tendrá el flujo de registro.
    const effectiveRole = isSignup ? "citizen" : role;
    const groups = effectiveRole === "dispatcher" ? ["dispatcher"] : ["citizen"];
    const sub =
      effectiveRole === "dispatcher"
        ? `DISP-${username.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "001"}`
        : `CIT-${username.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "001"}`;

    try {
      // TODO(back): POST /auth/login o /auth/register IdP (HU-12)
      const { user } = await loginDev({
        sub,
        preferred_username: username,
        groups,
        hasAntipanicButton:
          effectiveRole === "citizen" ? hasAntipanicButton : false,
        loginMethod: "sesion",
      });
      router.replace(getHomePathForUser(user));
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

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4 md:p-12">
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-xl p-6 md:p-8 flex flex-col gap-8">
          <div className="text-center flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-primary text-5xl bg-surface-container rounded-full p-4">
              {isSignup ? "person_add" : "security"}
            </span>
            <div>
              <h1 className="text-2xl md:text-[32px] font-bold text-primary leading-tight">
                CityPass<span style={{ color: "rgb(210, 152, 63)" }}>+</span>
              </h1>
              <p className="text-base text-on-surface-variant mt-2">
                {isSignup
                  ? "Creá tu cuenta ciudadana para guardar datos y preferencias."
                  : "Acceso seguro a los servicios de la ciudad."}
              </p>
              {isSignup && (
                <p className="text-xs text-on-surface-variant/80 max-w-sm">
                  Demo local: no registra una cuenta real en el IdP; emite la misma sesión de desarrollo.
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="email"
                  className="text-sm font-semibold tracking-wide text-on-surface"
                >
                  Usuario
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="jperez"
                  defaultValue={isSignup ? "" : "jperez"}
                  key={mode}
                  required
                  className="h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all"
                />
              </div>

              {!isSignup && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold tracking-wide text-on-surface">
                    Rol
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("citizen")}
                      className={`h-12 rounded-lg border font-semibold text-sm transition-colors ${
                        role === "citizen"
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container border-outline-variant text-on-surface"
                      }`}
                    >
                      Ciudadano
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("dispatcher")}
                      className={`h-12 rounded-lg border font-semibold text-sm transition-colors ${
                        role === "dispatcher"
                          ? "bg-primary text-on-primary border-primary"
                          : "bg-surface-container border-outline-variant text-on-surface"
                      }`}
                    >
                      Dispatcher
                    </button>
                  </div>
                </div>
              )}

              {/* Toggle Botón Antipánico — solo visible en modo mock (ANTIPANIC_MODE="mock").
                  En modo "backend" este campo viene del endpoint GET /api/user. */}
              {(isSignup || role === "citizen") && ANTIPANIC_MODE === "mock" && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MaterialIcon name="emergency" size={22} className="text-error shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface truncate">Botón Antipánico</p>
                      <p className="text-xs text-on-surface-variant leading-tight">Acceso rápido a emergencia</p>
                    </div>
                  </div>
                  <button
                    id="toggle-antipanic"
                    type="button"
                    role="switch"
                    aria-checked={hasAntipanicButton}
                    onClick={() => setHasAntipanicButton((v) => !v)}
                    className={`shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                      hasAntipanicButton ? "bg-error" : "bg-outline-variant"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        hasAntipanicButton ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="min-h-[52px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading
                  ? isSignup
                    ? "Creando cuenta..."
                    : "Ingresando..."
                  : isSignup
                    ? "Registrarme"
                    : "Iniciar sesión"}
                <MaterialIcon name={isSignup ? "person_add" : "arrow_forward"} />
              </button>

              {!isSignup && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setRole("citizen");
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
                  <span className="sm:hidden">Ciudadano</span>
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-sm text-on-surface-variant">
            {isSignup ? (
              <>
                ¿Ya tenés cuenta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Iniciar sesión
                </button>
              </>
            ) : (
              <>
                ¿No tenés cuenta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setRole("citizen");
                    setError("");
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Registrate
                </button>
              </>
            )}
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs font-medium text-on-surface-variant flex items-center justify-center gap-1">
            <MaterialIcon name="lock" size={16} />
            Sesión en cookie httpOnly (BFF Next.js)
          </p>
        </div>
      </div>
    </div>
  );
}
