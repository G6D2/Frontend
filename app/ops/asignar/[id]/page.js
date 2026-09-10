"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MaterialIcon from "../../../components/civic/MaterialIcon";
import {
  fetchEmergencyDetail,
  fetchOfficers,
  assignOfficer,
  getStoredUser,
  fetchCurrentUser,
  ApiError,
} from "../../../lib/api";
import { isDispatcher } from "../../../lib/auth";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  locationLabel,
} from "../../../lib/emergencies";

export default function AsignarOficialPage() {
  const params = useParams();
  const router = useRouter();
  const [emergency, setEmergency] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser() || (await fetchCurrentUser());
        if (!isDispatcher(user)) {
          router.replace("/inicio");
          return;
        }
        const [data, officerList] = await Promise.all([
          fetchEmergencyDetail(params.id),
          fetchOfficers(),
        ]);
        if (!cancelled) {
          setEmergency(data);
          setOfficers(officerList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const priority = PRIORITY_CONFIG[emergency?.severity || "critical"];

  async function handleAssign(officerId) {
    if (!emergency || busyId) return;
    setBusyId(officerId);
    setError("");
    try {
      await assignOfficer(emergency.id, officerId);
      router.push("/ops/lista");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors"
      >
        <MaterialIcon name="arrow_back" />
        <span className="text-[11px] font-bold uppercase tracking-widest">
          Volver
        </span>
      </button>

      {error && (
        <div className="p-3 mb-4 rounded bg-error-container text-on-error-container text-sm">
          {error}
        </div>
      )}

      {emergency && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-on-surface">
              Asignar Oficial
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-${priority.color}) 20%, transparent)`,
                color: `var(--color-${priority.color})`,
              }}
            >
              {priority.label}
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">
            #{emergency.id.slice(0, 8)} · {getStatusConfig(emergency.status).label} ·{" "}
            {locationLabel(emergency)}
          </p>
          <p className="text-xs text-on-surface-variant mt-2 italic">
            &quot;{emergency.description}&quot;
          </p>
        </div>
      )}

      <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
        Oficiales
      </h2>

      <div className="flex flex-col gap-2">
        {officers.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No hay oficiales en el catálogo.
          </p>
        ) : (
          officers.map((officer) => {
            const available = officer.status === "disponible";
            const initials = (officer.badgeNumber || officer.id || "?")
              .toString()
              .slice(-2);
            return (
              <div
                key={officer.id}
                className={`flex items-center justify-between p-4 border rounded transition-colors ${
                  available
                    ? "border-outline-variant bg-surface-container-lowest"
                    : "border-outline-variant/50 bg-surface-container opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">
                      {officer.name}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {officer.location || "—"}
                      {officer.distance ? ` · ${officer.distance}` : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!available || Boolean(busyId)}
                  onClick={() => handleAssign(officer.id)}
                  className={`h-8 px-4 rounded text-[11px] font-bold uppercase tracking-widest ${
                    available
                      ? "bg-primary text-on-primary disabled:opacity-50"
                      : "bg-primary/40 text-on-primary cursor-not-allowed"
                  }`}
                >
                  {busyId === officer.id
                    ? "Asignando…"
                    : available
                      ? "Asignar"
                      : officer.status}
                </button>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
