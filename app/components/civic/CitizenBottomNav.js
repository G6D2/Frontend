"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MaterialIcon from "./MaterialIcon";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: "home" },
  { href: "/reportar", label: "Reportar", icon: "add_alert", emphasized: true },
  { href: "/mis-alertas", label: "Mis alertas", icon: "history" },
  { href: "/perfil", label: "Perfil", icon: "person" },
];

export default function CitizenBottomNav() {
  const pathname = usePathname();
  const [sosOpen, setSosOpen] = useState(false);

  useEffect(() => {
    const sync = () => setSosOpen(document.body.dataset.sosOpen === "1");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-sos-open"],
    });
    return () => observer.disconnect();
  }, []);

  // Detail pages hide bottom nav per design
  if (/^\/mis-alertas\/[^/]+$/.test(pathname)) return null;
  if (sosOpen) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around items-center px-2 pb-safe h-20 bg-surface shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] rounded-t-xl lg:hidden">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(tab.href + "/");

        if (tab.emphasized && !isActive) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center px-4 pt-8 pb-1 min-w-touch min-h-touch cursor-pointer group"
            >
              <span className="absolute -top-6 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg flex items-center justify-center border-4 border-surface transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <MaterialIcon name={tab.icon} filled size={24} />
              </span>
              <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">
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
