"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import { ANALYTICS_EMBED_URL } from "../../lib/analytics";
import PageHeader from "../../components/PageHeader";
import MaterialIcon from "../../components/civic/MaterialIcon";

export default function OpsAnaliticaPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

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
      <PageHeader
        title="Analítica"
        right={
          <a
            href={ANALYTICS_EMBED_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir analítica en una pestaña nueva"
            title="Abrir en una pestaña nueva"
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="open_in_new" />
          </a>
        }
      />
      <div className="relative flex-1 min-h-0">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant">
            Cargando analítica…
          </div>
        )}
        <iframe
          src={ANALYTICS_EMBED_URL}
          title="Analítica de emergencias"
          className="absolute inset-0 w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
