"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "./MaterialIcon";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: "home" },
  { href: "/reportar", label: "Reportar", icon: "add_alert", emphasized: true },
  { href: "/mis-alertas", label: "Mis alertas", icon: "history" },
  { href: "/perfil", label: "Perfil", icon: "person" },
];

export default function CitizenBottomNav() {
  const pathname = usePathname();

  // Detail pages hide bottom nav per design
  if (/^\/mis-alertas\/[^/]+$/.test(pathname)) return null;

  return (
    <nav
      aria-label="Navegación del ciudadano"
      className="fixed inset-x-0 bottom-0 z-50 bg-surface shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] rounded-t-xl pb-safe lg:hidden"
    >
      {/* Fila de tabs de alto fijo: el pb-safe queda fuera de la fila, así
          el label nunca cae en la zona del safe-area (antes el tab Reportar
          usaba pt-8 y a veces quedaba recortado abajo). */}
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");

          if (tab.emphasized && !isActive) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center px-4 min-w-touch h-full cursor-pointer group"
              >
                {/* Círculo elevado, centrado sobre el tab */}
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg flex items-center justify-center border-4 border-surface transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                  <MaterialIcon name={tab.icon} filled size={24} />
                </span>
                {/* Placeholder del alto del ícono para alinear el label con
                    el resto de los tabs */}
                <span aria-hidden className="block h-6 w-6" />
                <span className="text-xs font-medium mt-1 text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center px-4 py-1.5 min-w-touch cursor-pointer transition-colors duration-200 ${
                isActive
                  ? "bg-primary text-on-primary rounded-2xl"
                  : "text-on-surface-variant hover:bg-surface-container-high rounded-lg"
              }`}
            >
              <MaterialIcon name={tab.icon} filled={isActive} />
              <span className="text-xs font-medium mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
