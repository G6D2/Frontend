"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, fetchCurrentUser } from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import { analyticsProxyUrl } from "../../lib/analytics";

// Pasa por el BFF, que agrega el Bearer del IdP (ver app/lib/analytics.js).
const EMBED_SRC = analyticsProxyUrl();
import PageHeader from "../../components/PageHeader";
import MaterialIcon from "../../components/civic/MaterialIcon";

export default function OpsAnaliticaPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  // La página es estática: el iframe puede terminar de cargar antes de que
  // React enganche onLoad. Como el embed es mismo origen (vía proxy), al
  // montarlo se mira si su documento ya está completo.
  const checkAlreadyLoaded = useCallback((el) => {
    try {
      const doc = el?.contentDocument;
      if (doc && doc.readyState === "complete" && doc.URL !== "about:blank") {
        setLoaded(true);
      }
    } catch {
      // sin acceso al documento: queda onLoad
    }
  }, []);

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
            href={EMBED_SRC}
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
          ref={checkAlreadyLoaded}
          src={EMBED_SRC}
          title="Analítica de emergencias"
          className="absolute inset-0 w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
