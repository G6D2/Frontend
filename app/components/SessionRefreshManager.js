"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Con expires_in = 900 s (15 min), renovar a los ~13 minutos según la guía oficial LDAP.
const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 780.000 ms

export default function SessionRefreshManager() {
  const pathname = usePathname();
  const router = useRouter();
  const lastRefreshRef = useRef(Date.now());
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    // Si estamos en pantallas públicas de autenticación, no programar refresh
    if (pathname === "/acceso" || pathname === "/logout") {
      return;
    }

    async function doRefresh() {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });

        if (res.ok) {
          lastRefreshRef.current = Date.now();
        } else if (res.status === 401) {
          // Sesión o refresh token vencido (8 horas transcurridas o revocado)
          router.replace("/acceso?expired=1");
        }
      } catch {
        // Error de red temporal: el interceptor en apiFetch reintentará en el próximo request
      } finally {
        isRefreshingRef.current = false;
      }
    }

    // Timer periódico de ~13 minutos
    const intervalId = setInterval(() => {
      doRefresh();
    }, REFRESH_INTERVAL_MS);

    // Si la pestaña estuvo en segundo plano o el equipo suspendido y vuelve a primer plano:
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastRefreshRef.current;
        if (elapsed >= REFRESH_INTERVAL_MS) {
          doRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router]);

  return null;
}
