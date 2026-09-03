"use client";

import Link from "next/link";
import MaterialIcon from "./MaterialIcon";

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
  // Navegación principal vive en CityPassAppShell (Navbar OfficerView).
  // showMenu se conserva en la API: muestra el título centrado sin drawer.
  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-4 h-14 bg-surface border-b border-outline-variant pt-safe">
      <div className="flex items-center gap-2 min-w-[44px]">
        {showBack ? (
          <Link
            href={backHref}
            aria-label="Volver"
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="arrow_back" />
          </Link>
        ) : (
          <MaterialIcon name="security" className="text-primary" />
        )}
      </div>

      {showBack || showMenu ? (
        <h1
          className={`text-xl font-bold text-primary truncate px-2 flex-1 ${
            showBack ? "text-center sm:text-left font-semibold" : "text-center"
          }`}
        >
          {title}
        </h1>
      ) : (
        <span className="text-xl font-bold text-primary truncate px-2 flex-1 hidden sm:block">
          {title}
        </span>
      )}

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
  );
}
