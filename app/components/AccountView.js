"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import MaterialIcon from "./civic/MaterialIcon";
import { logout } from "../lib/api";

/** Pill del rol/grupo — mismo patrón `bg-*-100 text-*-800` que ya usan las
 * demás pills de la app. Se elige por el primer grupo reconocido del token;
 * si no hay ninguno reconocido, un gris neutro. */
const ROLE_PILL_CLASS = {
  dispatcher: "bg-indigo-100 text-indigo-800",
  citizen: "bg-blue-100 text-blue-800",
  officer: "bg-teal-100 text-teal-800",
};
const ROLE_PILL_FALLBACK = "bg-gray-100 text-gray-700";

function rolePillClass(groups) {
  const known = (groups || [])
    .map((g) => String(g).toLowerCase())
    .find((g) => ROLE_PILL_CLASS[g]);
  return known ? ROLE_PILL_CLASS[known] : ROLE_PILL_FALLBACK;
}

/**
 * Vista de "Mi cuenta" compartida por ciudadano (app/(citizen)/perfil/page.js)
 * y dispatcher (app/ops/cuenta/page.js). Antes cada rol tenía su propio
 * layout y un botón de logout con estilo distinto (ciudadano: borde+texto
 * secondary; dispatcher: botón sólido bg-error). Ahora las dos usan el
 * mismo avatar con iniciales, nombre, `sub` en mono, rol como pill, lista de
 * accesos (si tiene) y el mismo botón de logout peligro-secundario (borde
 * error, texto error, ícono logout).
 *
 * `accessItems`: accesos propios del rol (el ciudadano pasa sus 3, el
 * dispatcher no tiene ninguno hoy y no renderiza la sección).
 * `showSignup`: tarjeta de alta solo para el ciudadano anónimo.
 */
export default function AccountView({
  user,
  accessItems = [],
  roleFallback = "Sin grupo",
  showSignup = false,
}) {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/acceso");
  }

  const roleLabel = (user?.groups || []).join(", ") || roleFallback;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-bold">
          {(user?.username || "CP").slice(0, 2).toUpperCase()}
        </div>
        <div className="text-center flex flex-col items-center gap-1.5">
          <h2 className="text-2xl font-bold text-primary">
            {user?.username || "Usuario"}
          </h2>
          <p className="text-sm text-on-surface-variant font-mono">
            {user?.sub || "—"}
          </p>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${rolePillClass(
              user?.groups
            )}`}
          >
            {roleLabel}
          </span>
        </div>
      </div>

      {accessItems.length > 0 && (
        <section className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-ambient-lvl2">
          {accessItems.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-container-low cursor-pointer transition-colors text-left ${
                i > 0 ? "border-t border-outline-variant/50" : ""
              }`}
            >
              <MaterialIcon
                name={item.icon}
                className="text-on-surface-variant"
              />
              <span className="text-base text-on-surface flex-1">
                {item.label}
              </span>
              <MaterialIcon
                name="chevron_right"
                className="text-on-surface-variant"
                size={20}
              />
            </Link>
          ))}
        </section>
      )}

      {/* Sign-up CTA — solo si entró anónimo; con sesión de cuenta o rol
          dispatcher no se muestra nada. */}
      {showSignup && (
        <div className="rounded-xl border border-outline-variant bg-white overflow-hidden flex items-center gap-4 px-4 py-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary text-on-primary">
            <MaterialIcon name="person_add" size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-on-surface">Sign up</p>
            <p className="text-xs text-on-surface-variant leading-tight mt-0.5">
              Registrate para guardar tus datos y preferencias
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.push("/acceso?signup=1");
            }}
            className="shrink-0 h-10 px-4 rounded-lg font-semibold text-sm transition-all bg-primary text-on-primary hover:opacity-90 cursor-pointer"
          >
            Registrarme
          </button>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 border border-error text-error font-semibold text-sm tracking-wide py-4 rounded-xl hover:bg-error-container transition-colors min-h-[56px] cursor-pointer"
      >
        <MaterialIcon name="logout" />
        Cerrar sesión
      </button>
    </div>
  );
}
