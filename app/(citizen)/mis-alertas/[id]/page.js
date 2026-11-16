"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../../components/civic/MaterialIcon";
import ConfirmCancelModal from "../../../components/civic/ConfirmCancelModal";
import {
  fetchEmergencyDetail,
  cancelEmergency,
  ApiError,
  CITIZEN_POLLING_INTERVAL_MS,
} from "../../../lib/api";
import { createPoller } from "../../../lib/polling";
import {
  getStatusConfig,
  isCancelable,
  isActiveStatus,
  isTerminalStatus,
  formatTime,
  formatTimeShort,
} from "../../../lib/emergencies";
import GeoLabel from "../../../components/civic/GeoLabel";

export default function AlertDetailPage() {
  const params = useParams();
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Sube cada vez que el usuario cancela (ver handleCancel).
  const cancelSeqRef = useRef(0);

  // Primera carga (con "Cargando…" y mensaje de error) y después un refresco
  // cada CITIZEN_POLLING_INTERVAL_MS con createPoller: no superpone pedidos, se
  // pausa con la pestaña oculta y se corta al desmontar. Con la emergencia ya
  // en pantalla el refresco es silencioso: si falla, no muestra error.
  useEffect(() => {
    let loaded = false;
    let poller = null;

    const load = async () => {
      const cancelSeq = cancelSeqRef.current;
      try {
        const data = await fetchEmergencyDetail(params.id);
        // Este pedido salió antes de que el usuario cancelara: trae el estado
        // viejo y pisaría la cancelación. Se descarta; el próximo trae el nuevo.
        if (cancelSeq !== cancelSeqRef.current) return;
        loaded = true;
        setEmergency(data);
        setError("");
        // En un estado terminal la emergencia ya no cambia: se deja de consultar.
        if (isTerminalStatus(data?.status)) poller.stop();
      } catch (err) {
        if (!loaded) setError(err.message || "No se pudo cargar la emergencia");
      } finally {
        setLoading(false);
      }
    };

    poller = createPoller({ load, intervalMs: CITIZEN_POLLING_INTERVAL_MS });
    poller.start();
    return () => poller.stop();
  }, [params.id]);

  const handleCancel = async (reason) => {
    if (!emergency || !isCancelable(emergency.status)) return;
    setCancelling(true);
    try {
      const cancelReason = reason || "Ya no necesito asistencia";
      const updated = await cancelEmergency(emergency.id, cancelReason);
      // Invalida los refrescos que estén en vuelo: se pidieron antes de cancelar.
      cancelSeqRef.current += 1;
      setEmergency((prev) => ({
        ...prev,
        ...updated,
        statusHistory: [
          ...(prev?.statusHistory || []),
          {
            previousStatus: prev?.status,
            newStatus: updated.status,
            reason: cancelReason,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      notifications.show({
        title: "Emergencia cancelada",
        message: "Se avisó que ya no necesitás ayuda.",
        color: "teal",
      });
      setCancelModalOpen(false);
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
  const history = emergency?.statusHistory || [];
  const isEmergencyActive = Boolean(emergency && isActiveStatus(emergency.status));

  return (
    <>
      <CitizenTopBar showBack backHref="/mis-alertas" title="Detalle de la alerta" />

      <CitizenPageContainer>
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
            <section
              className={`bg-surface-container-high rounded-xl p-6 shadow-sm border border-surface-container flex flex-col items-center text-center ${
                isEmergencyActive ? "emergency-pulse-ring" : ""
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary mb-4 shadow-md">
                <MaterialIcon
                  name={
                    emergency.status === "CANCELLED" ? "cancel" : "emergency"
                  }
                  filled
                  size={32}
                />
              </div>
              <h2 className="text-2xl font-bold text-on-surface">
                {statusCfg.label}
              </h2>
              <p className="text-base text-on-surface-variant mt-2 max-w-[250px]">
                {emergency.description}
              </p>
            </section>

            <section className="bg-surface rounded-xl p-4 border border-outline-variant flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wide text-on-surface">
                Detalles
              </h3>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon
                  name="location_on"
                  size={18}
                  className="text-primary"
                />
                <span>
                  <GeoLabel emergency={emergency} fallback="Obteniendo dirección…" />
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon name="schedule" size={18} />
                <span>{formatTime(emergency.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon name="priority_high" size={18} className="text-error" />
                <span>Severidad: {emergency.severity || "critical"}</span>
              </div>
            </section>

            <section className="bg-surface rounded-xl p-4 border border-outline-variant flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-wide text-on-surface">
                Historial de estados
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Sin cambios de estado todavía.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {history.map((entry, index) => {
                    const label = getStatusConfig(entry.newStatus).label;
                    return (
                      <li
                        key={`${entry.id || index}-${entry.newStatus}`}
                        className="flex gap-3 text-sm"
                      >
                        <div className="flex flex-col items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                          {index < history.length - 1 && (
                            <span className="flex-1 w-px bg-outline-variant my-1" />
                          )}
                        </div>
                        <div className="pb-1">
                          <div className="font-semibold text-on-surface">
                            {label}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {formatTimeShort(entry.createdAt) ||
                              formatTime(entry.createdAt)}
                            {entry.reason ? ` · ${entry.reason}` : ""}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {isCancelable(emergency.status) && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                disabled={cancelling}
                aria-busy={cancelling}
                className="w-full bg-surface text-secondary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-secondary/40 cursor-pointer hover:bg-error-container transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <MaterialIcon name="cancel" />
                {cancelling ? "Cancelando…" : "Cancelar asistencia"}
              </button>
            )}

            <a
              href="tel:911"
              className="w-full bg-surface text-error font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-error/30 cursor-pointer hover:bg-error-container transition-colors flex items-center justify-center gap-2"
            >
              <MaterialIcon name="call" />
              Llamar al 911
            </a>
          </>
        )}
      </CitizenPageContainer>

      <ConfirmCancelModal
        open={cancelModalOpen}
        onClose={() => (cancelling ? null : setCancelModalOpen(false))}
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </>
  );
}
