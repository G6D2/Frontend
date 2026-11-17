"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  getStatusConfig,
  getEffectivePriority,
} from "../../../lib/emergencies";
import GeoLabel from "../../../components/civic/GeoLabel";
import PageHeader from "../../../components/PageHeader";
import { BTN_BASE, BTN_PRIMARY } from "../../../components/ops/buttonStyles";
import {
  PriorityBadge,
  officerStatusLabel,
} from "../../../components/ops/OpsBadges";
import {
  IncidentBadge,
  IncidentDetailBlock,
  ZoneContextBadge,
  ZoneContextNotice,
} from "../../../components/ops/IncidentInfo";
import { OriginBadge, OriginNotice } from "../../../components/ops/OriginInfo";

export default function AsignarOficialPage() {
  const params = useParams();
  const router = useRouter();
  const [emergency, setEmergency] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

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
    <>
      <PageHeader title="Asignar oficial" showBack backHref="/ops/lista" />
      <main className="p-4 max-w-2xl mx-auto">
        {error && (
          <div className="p-3 mb-4 rounded bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div
            className="h-28 mb-6 rounded border border-outline-variant bg-surface-container-lowest animate-pulse"
            aria-hidden="true"
          />
        )}

        {emergency && (
          <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 mb-6">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                Emergencia
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <PriorityBadge severity={getEffectivePriority(emergency)} />
                <IncidentBadge emergency={emergency} />
                <ZoneContextBadge emergency={emergency} />
                <OriginBadge emergency={emergency} />
              </div>
            </div>
            <p className="text-sm text-on-surface-variant">
              #{emergency.id.slice(0, 8)} · {getStatusConfig(emergency.status).label} ·{" "}
              <GeoLabel emergency={emergency} fallback="Obteniendo dirección…" />
            </p>
            <p className="text-xs text-on-surface-variant mt-2 italic">
              &quot;{emergency.description}&quot;
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <OriginNotice emergency={emergency} />
              <IncidentDetailBlock emergency={emergency} />
              <ZoneContextNotice emergency={emergency} />
            </div>
          </div>
        )}

        <h2 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
          Oficiales
        </h2>

        <div className="flex flex-col gap-2">
          {loading ? (
            <p role="status" className="text-sm text-on-surface-variant">
              Cargando oficiales…
            </p>
          ) : officers.length === 0 ? (
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
                    className={`${BTN_BASE} ${BTN_PRIMARY} h-8 px-4`}
                  >
                    {busyId === officer.id
                      ? "Asignando…"
                      : available
                        ? "Asignar"
                        : officerStatusLabel(officer.status)}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
