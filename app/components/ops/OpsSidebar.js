"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "../../lib/api";
import MaterialIcon from "../civic/MaterialIcon";

const navItems = [
  { href: "/ops", label: "Operaciones", icon: "dashboard" },
  { href: "/ops/mapa", label: "Mapa", icon: "map" },
  { href: "/ops/oficiales", label: "Oficiales", icon: "group" },
  { href: "/ops/historial", label: "Historial", icon: "history" },
  // TODO(back): pantalla rol officer (HU-08/09/10) cuando exista grupo `officer`
];

export default function OpsSidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-on-background/40 transition-opacity lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <nav
        className={`fixed inset-y-0 left-0 z-[60] flex w-[min(280px,85vw)] flex-col bg-inverse-surface border-r border-outline-variant transition-transform duration-200 ease-out lg:translate-x-0 lg:w-[280px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 lg:p-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-black text-on-primary">CityPass</h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-primary/80 mt-1">
              Emergencias
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onClose}
            className="lg:hidden min-w-touch min-h-touch flex items-center justify-center rounded text-outline-variant hover:text-on-primary"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/ops"
                ? pathname === "/ops"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-4 p-4 transition-colors duration-150 ${
                  isActive
                    ? "text-on-primary bg-primary-container border-l-4 border-secondary scale-[0.98]"
                    : "text-outline-variant hover:text-on-primary hover:bg-primary-fixed-dim"
                }`}
              >
                <MaterialIcon name={item.icon} filled={isActive} />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push("/acceso");
            }}
            className="flex w-full items-center gap-4 text-outline-variant hover:text-on-primary p-4 hover:bg-primary-fixed-dim transition-colors duration-150"
          >
            <MaterialIcon name="logout" />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Salir
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
