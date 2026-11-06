"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createSessionRefresher,
  SESSION_REFRESH_INTERVAL_MS,
} from "../lib/sessionRefresh";

// Renueva la sesión del Login Federado cada ~13 min y al volver a la pestaña.
// Las reglas (sesión local, refresh fallido con token vigente, token vencido)
// están en app/lib/sessionRefresh.js.
export default function SessionRefreshManager() {
  const pathname = usePathname();
  const router = useRouter();
  const [refresher] = useState(() =>
    createSessionRefresher({
      refresh: () =>
        fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" }),
      onExpired: () => router.replace("/acceso?expired=1"),
    })
  );

  useEffect(() => {
    // En las pantallas de autenticación no se refresca; la sesión que venga
    // después puede ser federada o local.
    if (pathname === "/acceso" || pathname === "/logout") {
      refresher.reset();
      return;
    }

    const intervalId = setInterval(() => {
      refresher.tick();
    }, SESSION_REFRESH_INTERVAL_MS);

    // Si la pestaña estuvo en segundo plano o el equipo suspendido y vuelve a primer plano:
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresher.onVisible();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, refresher]);

  return null;
}
