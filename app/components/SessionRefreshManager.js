"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createSessionRefresher,
  isAuthScreen,
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

  // La ruta se lee desde un ref y no es dependencia del efecto del timer: si
  // lo fuera, cada navegación lo reiniciaba y, navegando al menos una vez
  // cada 13 min, el refresh no corría nunca (el token del personal dura 15).
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    // En las pantallas de autenticación no se refresca (lo decide el
    // refresher con la ruta que recibe); la sesión que venga después puede
    // ser federada o local.
    if (isAuthScreen(pathname)) refresher.reset();
  }, [pathname, refresher]);

  // Se monta una sola vez: navegar no reinicia el timer.
  useEffect(() => {
    const intervalId = setInterval(() => {
      refresher.tick(pathnameRef.current);
    }, SESSION_REFRESH_INTERVAL_MS);

    // Si la pestaña estuvo en segundo plano o el equipo suspendido y vuelve a primer plano:
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresher.onVisible(pathnameRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresher]);

  return null;
}
