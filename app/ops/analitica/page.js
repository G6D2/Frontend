"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import { ANALYTICS_PROXY_PATH } from "../../lib/analytics";
import PageHeader from "../../components/PageHeader";

const noopSubscribe = () => () => {};

export default function OpsAnaliticaPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  // El iframe se monta recién en el cliente (false en el prerender, true al
  // hidratar): así onLoad siempre está enganchado cuando termina de cargar.
  // Con sandbox no se puede mirar su contentDocument para saberlo después.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Mismo guard de rol que el resto de /ops (el middleware ya filtra; esto
  // cubre sesiones cuyo user cacheado no sea dispatcher).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!cancelled && !isDispatcher(user)) router.replace("/inicio");
      } catch {
        if (!cancelled) router.replace("/acceso");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col h-[calc(100dvh-64px-env(safe-area-inset-bottom,0px))] md:h-dvh">
      <PageHeader title="Analítica" />
      <div className="relative flex-1 min-h-0">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">
            Cargando analítica…
          </div>
        )}
        {mounted && (
          <iframe
            src={ANALYTICS_PROXY_PATH}
            title="Analítica de emergencias"
            // Sin allow-same-origin: el tablero se sirve desde nuestro origen
            // y sin sandbox su JS podría llamar a /api/backend con la sesión
            // del dispatcher. Lo pidió Analítica y el tablero renderiza así.
            sandbox="allow-scripts"
            className={`absolute inset-0 w-full h-full border-0 ${loaded ? "" : "invisible"}`}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
    </div>
  );
}
