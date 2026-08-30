"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "../../lib/api";
import MaterialIcon from "./MaterialIcon";

const NAV_ITEMS = [
  { href: "/inicio", label: "Inicio", icon: "home" },
  { href: "/reportar", label: "Reportar Emergencia", icon: "add_alert", accent: true },
  { href: "/mis-alertas", label: "Mis alertas", icon: "history" },
  { href: "/perfil", label: "Perfil", icon: "person" },
];

export default function CitizenTopBar({
  title = "CityPass Emergencias",
  showBack = false,
  backHref = "/inicio",
  showClose = false,
  onClose,
  showMenu = false,
  showNotifications = true,
  hasNotificationDot = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-14 bg-surface border-b border-outline-variant pt-safe">
        <div className="flex items-center gap-2 min-w-[44px]">
          {showBack ? (
            <Link
              href={backHref}
              aria-label="Volver"
              className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <MaterialIcon name="arrow_back" />
            </Link>
          ) : showMenu ? (
            <button
              type="button"
              aria-label="Menú"
              aria-expanded={menuOpen}
              aria-controls="citizen-drawer"
              onClick={() => setMenuOpen(true)}
              className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <MaterialIcon name="menu" />
            </button>
          ) : (
            <>
              <MaterialIcon name="security" className="text-primary" />
              <span className="text-xl font-bold text-primary hidden sm:inline">
                {title}
              </span>
            </>
          )}
        </div>

        {showBack ? (
          <h1 className="text-xl font-semibold text-primary truncate px-2 flex-1 text-center sm:text-left">
            {title}
          </h1>
        ) : showMenu ? (
          <h1 className="text-xl font-bold text-primary truncate px-2 flex-1 text-center">
            {title}
          </h1>
        ) : null}

        <div className="flex items-center min-w-[44px] justify-end">
          {showClose ? (
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <MaterialIcon name="close" />
            </button>
          ) : showNotifications ? (
            <button
              type="button"
              aria-label="Notificaciones"
              // TODO(back): panel de notificaciones / alertas del ciudadano (push o polling)
              className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors relative"
            >
              <MaterialIcon name="notifications" />
              {hasNotificationDot && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
              )}
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
      </header>

      {showMenu && (
        <div
          className={`fixed inset-0 z-[80] ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
            className={`absolute inset-0 bg-on-background/40 transition-opacity duration-200 ${
              menuOpen ? "opacity-100" : "opacity-0"
            }`}
          />
          <aside
            id="citizen-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación"
            className={`absolute top-0 left-0 h-full w-[min(20rem,85vw)] bg-surface border-r border-outline-variant shadow-xl flex flex-col transition-transform duration-200 ease-out ${
              menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <MaterialIcon name="security" className="text-primary" />
                <span className="font-bold text-primary">CityPass</span>
              </div>
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
                className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <nav className="flex-1 p-4 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl min-h-touch transition-colors ${
                      item.accent
                        ? "bg-secondary text-on-secondary"
                        : isActive
                          ? "bg-primary-container text-on-primary-container"
                          : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <MaterialIcon name={item.icon} filled={isActive || item.accent} />
                    <span className="text-sm font-semibold tracking-wide">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-outline-variant">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  setMenuOpen(false);
                  router.push("/acceso");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl min-h-touch text-secondary hover:bg-error-container transition-colors"
              >
                <MaterialIcon name="logout" />
                <span className="text-sm font-semibold tracking-wide">
                  Cerrar sesión
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
