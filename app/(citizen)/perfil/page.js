"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  getStoredUser,
  fetchCurrentUser,
  logout,
} from "../../lib/api";

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => router.replace("/acceso"));
  }, [router]);

  const menuItems = [
    // TODO(back): hoy vive en localStorage; migrar a endpoints reales cuando exista el perfil de ciudadano.
    { icon: "person", label: "Datos personales", href: "/perfil/datos" },
    { icon: "location_on", label: "Ubicaciones guardadas", href: "/perfil/ubicaciones" },
    { icon: "help", label: "Ayuda", href: "/perfil/ayuda" },
  ];

  const isAnon = user?.loginMethod === "anonima";

  return (
    <>
      <CitizenTopBar showMenu />

      <main className="flex-grow pb-24 lg:pb-8 px-4 md:px-12 max-w-[1280px] mx-auto w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-bold">
            {(user?.username || "CP").slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary">
              {user?.username || "Ciudadano"}
            </h2>
            <p className="text-base text-on-surface-variant font-mono text-sm">
              {user?.sub || "—"}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              {(user?.groups || []).join(", ") || "sin grupo"}
            </p>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-ambient-lvl2">
          {menuItems.map((item, i) => (
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

        {/* Sign-up CTA — solo si entró anónimo; con sesión de cuenta no se muestra nada */}
        {isAnon && (
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
          onClick={async () => {
            await logout();
            router.push("/acceso");
          }}
          className="w-full flex items-center justify-center gap-2 bg-surface text-secondary font-semibold text-sm tracking-wide py-4 rounded-xl border border-outline-variant hover:bg-error-container transition-colors min-h-[56px] cursor-pointer"
        >
          <MaterialIcon name="logout" />
          Cerrar sesión
        </button>
      </main>
    </>
  );
}
