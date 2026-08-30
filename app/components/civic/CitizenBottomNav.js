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
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-safe h-20 bg-surface shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] rounded-t-xl md:hidden">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");

        if (tab.emphasized && !isActive) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1 min-w-touch min-h-touch relative"
            >
              <div className="absolute -top-6 bg-secondary text-on-secondary rounded-full p-3 shadow-lg flex items-center justify-center border-4 border-surface">
                <MaterialIcon name={tab.icon} filled size={20} />
              </div>
              <span className="text-xs font-medium mt-7">{tab.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center justify-center px-4 py-1 min-w-touch min-h-touch transition-transform duration-200 ${
              isActive
                ? "bg-primary-container text-on-primary-container rounded-2xl scale-95"
                : "text-on-surface-variant hover:bg-surface-container-high rounded-lg"
            }`}
          >
            <MaterialIcon name={tab.icon} filled={isActive} />
            <span className="text-xs font-medium mt-1">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
