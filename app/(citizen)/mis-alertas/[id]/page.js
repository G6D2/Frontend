"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { notifications } from "@mantine/notifications";
import MaterialIcon from "../../../components/civic/MaterialIcon";
import {
  fetchEmergencyById,
  cancelEmergency,
  ApiError,
} from "../../../lib/api";
import {
  getStatusConfig,
  isCancelable,
  locationLabel,
  formatTime,
} from "../../../lib/emergencies";

export default function AlertDetailPage() {
  const params = useParams();
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchEmergencyById(params.id);
        if (!cancelled) setEmergency(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "No se pudo cargar la emergencia");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleCancel = async () => {
    if (!emergency || !isCancelable(emergency.status)) return;
    setCancelling(true);
    try {
      const updated = await cancelEmergency(
        emergency.id,
        "Ya no necesito asistencia"
      );
      setEmergency(updated);
      notifications.show({
        title: "Emergencia cancelada",
        message: "Se avisó que ya no necesitás ayuda.",
        color: "teal",
      });
    } catch (err) {
      notifications.show({
        title: "No se pudo cancelar",
        message: err instanceof ApiError ? err.message : "Error desconocido",
        color: "red",
      });
    } finally {
      setCancelling(false);
    }
  };

  const statusCfg = getStatusConfig(emergency?.status);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 w-full z-50 flex items-center px-4 h-14 bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <Link
          href="/mis-alertas"
          aria-label="Volver"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-primary"
        >
          <MaterialIcon name="arrow_back" size={28} />
        </Link>
        <h1 className="text-xl font-semibold text-primary ml-2 flex-1 truncate">
          Estado de emergencia
        </h1>
      </header>

      <main className="mt-14 p-4 md:p-12 max-w-md w-full mx-auto flex-1 flex flex-col gap-6 pb-8">
        {loading && (
          <p className="text-on-surface-variant text-center py-12">Cargando…</p>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container">
            {error}
          </div>
        )}

        {emergency && (
          <>
            <section className="bg-surface-container-high rounded-xl p-6 shadow-sm border border-surface-container relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute inset-0 bg-primary opacity-5 animate-pulse rounded-xl pointer-events-none" />
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary mb-4 relative z-10 shadow-md">
                <MaterialIcon
                  name={
                    emergency.status === "CANCELLED" ? "cancel" : "emergency"
                  }
                  filled
                  size={32}
                />
              </div>
              <h2 className="text-2xl font-bold text-on-surface relative z-10">
                {statusCfg.label}
              </h2>
              <p className="text-base text-on-surface-variant mt-2 max-w-[250px] relative z-10">
                {emergency.description}
              </p>
            </section>

            <section className="bg-surface rounded-xl p-4 border border-outline-variant flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wide text-on-surface">
                Detalles
              </h3>
              {/* TODO(back): timeline real con fetchEmergencyHistory(id) — CREATED→…→RESOLVED */}
              {/* TODO(back): actualizar en vivo cuando llegue EmergenciaEstadoActualizado */}
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon
                  name="location_on"
                  size={18}
                  className="text-primary"
                />
                <span>{locationLabel(emergency)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon name="schedule" size={18} />
                <span>{formatTime(emergency.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant font-mono">
                <MaterialIcon name="tag" size={18} />
                <span className="truncate">{emergency.id}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon name="priority_high" size={18} className="text-error" />
                <span>Severidad: {emergency.severity || "critical"}</span>
              </div>
            </section>

            {isCancelable(emergency.status) && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full bg-surface text-secondary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-secondary/40 hover:bg-error-container transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <MaterialIcon name="cancel" />
                {cancelling ? "Cancelando…" : "Cancelar asistencia"}
              </button>
            )}

            <button className="w-full bg-surface text-error font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-error/30 hover:bg-error-container transition-colors flex items-center justify-center gap-2">
              <MaterialIcon name="call" />
              Llamar al 911
            </button>
          </>
        )}
      </main>
    </div>
  );
}
