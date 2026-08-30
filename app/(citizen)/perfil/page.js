"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    // TODO(back): pantallas/endpoints de perfil ciudadano (datos, ubicaciones, prefs)
    { icon: "person", label: "Datos personales" },
    { icon: "location_on", label: "Ubicaciones guardadas" },
    { icon: "notifications", label: "Notificaciones" },
    { icon: "shield", label: "Privacidad y seguridad" },
    { icon: "help", label: "Ayuda" },
  ];

  return (
    <>
      <CitizenTopBar showMenu />

      <main className="flex-grow pt-20 pb-32 px-4 md:px-12 max-w-[1280px] mx-auto w-full flex flex-col gap-6">
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
            <button
              key={item.label}
              className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-container-low transition-colors text-left ${
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
            </button>
          ))}
        </section>

        <button
          onClick={async () => {
            await logout();
            router.push("/acceso");
          }}
          className="w-full flex items-center justify-center gap-2 bg-surface text-secondary font-semibold text-sm tracking-wide py-4 rounded-xl border border-outline-variant hover:bg-error-container transition-colors min-h-[56px]"
        >
          <MaterialIcon name="logout" />
          Cerrar sesión
        </button>
      </main>
    </>
  );
}
