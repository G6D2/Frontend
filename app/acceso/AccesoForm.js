"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "../components/civic/MaterialIcon";
import { loginDev, ApiError, getHomePathForUser } from "../lib/api";

export default function AccesoForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("citizen");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.target;
    const username = (form.email.value || "ciudadano").trim();
    // TODO(back): rol real viene del IdP — selector solo para AUTH_MODE=local
    const groups = role === "dispatcher" ? ["dispatcher"] : ["citizen"];
    const sub =
      role === "dispatcher"
        ? `DISP-${username.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "001"}`
        : `CIT-${username.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "001"}`;

    try {
      // TODO(back): POST /auth/login IdP (HU-12)
      const { user } = await loginDev({
        sub,
        preferred_username: username,
        groups,
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
              security
            </span>
            <div>
              <h1 className="text-2xl md:text-[32px] font-bold text-primary leading-tight">
                CityPass Emergencias
              </h1>
              <p className="text-base text-on-surface-variant mt-2">
                Acceso seguro a los servicios de la ciudad.
              </p>
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
                  defaultValue="jperez"
                  required
                  className="h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all"
                />
              </div>

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
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-4 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="h-14 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 min-h-[56px] disabled:opacity-60"
              >
                {loading ? "Ingresando..." : "Iniciar sesión"}
                <MaterialIcon name="arrow_forward" />
              </button>
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
                className="h-12 w-full bg-surface-container text-on-surface font-semibold text-sm tracking-wide rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
              >
                <MaterialIcon name="account_balance" className="text-primary" />
                Iniciar con cuenta ciudadana
              </button>
            </div>
          </form>
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
