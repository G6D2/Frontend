"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchOfficers,
  getStoredUser,
  fetchCurrentUser,
  ApiError,
} from "../../lib/api";
import { isDispatcher } from "../../lib/auth";
import PageHeader from "../../components/PageHeader";
import { OfficerStatusBadge } from "../../components/ops/OpsBadges";

export default function OficialesPage() {
  const router = useRouter();
  const [officers, setOfficers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) {
          router.replace("/inicio");
          return;
        }
        const data = await fetchOfficers();
        if (!cancelled) setOfficers(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los oficiales"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <PageHeader title="Oficiales" />
      <main className="p-4">
        {error && (
          <div className="p-3 mb-4 rounded bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-on-surface-variant">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {officers.map((o) => {
              const initials = (o.badgeNumber || o.id || "?")
                .toString()
                .slice(-2);
              return (
                <div
                  key={o.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
                    {initials}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-on-surface">{o.name}</div>
                    <div className="text-xs text-on-surface-variant">
                      {o.location || o.badgeNumber || "—"}
                    </div>
                  </div>
                  <OfficerStatusBadge status={o.status} />
                </div>
              );
            })}
            {officers.length === 0 && !error && (
              <p className="text-sm text-on-surface-variant col-span-full">
                No hay oficiales cargados.
              </p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
