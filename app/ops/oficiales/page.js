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
    <main className="p-4">
      <h1 className="text-xl font-bold text-primary mb-6">Oficiales</h1>
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
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                  style={{
                    backgroundColor:
                      o.status === "disponible"
                        ? "color-mix(in srgb, var(--color-status-validada) 20%, transparent)"
                        : "color-mix(in srgb, var(--color-status-pendiente) 20%, transparent)",
                    color:
                      o.status === "disponible"
                        ? "var(--color-status-validada)"
                        : "var(--color-status-pendiente)",
                  }}
                >
                  {(o.status || "—").replace("_", " ")}
                </span>
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
  );
}
