"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import SosConfirmationModal from "../../components/civic/SosConfirmationModal";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  triggerPanicButton,
  getCurrentLocation,
  ApiError,
} from "../../lib/api";

export default function InicioClient() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Obteniendo ubicación…");

  useEffect(() => {
    getCurrentLocation().then((loc) => {
      setLocationStatus(
        loc.precise
          ? "Ubicación precisa obtenida"
          : "Usando última ubicación conocida (imprecisa)"
      );
    });
  }, []);

  const handleConfirmSos = async (optionalDescription = "") => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await triggerPanicButton({
        latitude: location.latitude,
        longitude: location.longitude,
        severity: "critical",
        emergencyType: "panic",
        description: optionalDescription || undefined,
      });
      // TODO(back): correlationId / eventId (HU-01)
      // TODO(back): reintento ante 504 del bus
      notifications.show({
        title: "Alerta enviada",
        message:
          result.message ||
          "Tu ubicación fue compartida con las autoridades.",
        color: "red",
        autoClose: 4000,
      });
      setModalOpen(false);
      router.push(`/mis-alertas/${result.emergencyId}`);
    } catch (err) {
      notifications.show({
        title: "Error",
        message:
          err instanceof ApiError
            ? err.message
            : "No se pudo enviar la alerta. Intentá de nuevo.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CitizenTopBar showMenu />

      <main className="flex-grow pt-14 pb-24 px-4 md:px-12 max-w-[1280px] mx-auto w-full flex flex-col items-center justify-center relative min-h-screen">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 bg-tertiary-container text-on-tertiary-container px-4 py-2 rounded-full text-xs font-medium shadow-sm w-max max-w-full">
          <MaterialIcon name="location_on" size={16} />
          <span>{locationStatus}</span>
        </div>

        <div className="flex flex-col items-center justify-center mt-12 w-full max-w-sm">
          <button
            aria-label="Pedir Ayuda"
            onClick={() => setModalOpen(true)}
            className="pulse-sos bg-error text-on-error w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-[0_8px_32px_rgba(186,26,26,0.4)] active:scale-95 transition-transform duration-200"
          >
            <MaterialIcon name="emergency" filled size={64} className="mb-4" />
            <span className="text-2xl font-bold uppercase tracking-wider">
              Pedir Ayuda
            </span>
          </button>
          <p className="text-base text-on-surface-variant text-center mt-8 px-4">
            Envía una alerta de emergencia con tu ubicación actual.
          </p>
        </div>

        <div className="mt-12 w-full max-w-sm">
          <button
            onClick={() => router.push("/reportar")}
            className="w-full flex items-center justify-center gap-2 bg-surface text-primary border border-outline px-6 py-4 rounded-xl font-semibold text-sm tracking-wide shadow-sm hover:bg-surface-container active:bg-surface-container-high transition-colors min-h-[56px]"
          >
            <MaterialIcon name="shield" size={20} />
            <span>Reportar un incidente</span>
          </button>
        </div>
      </main>

      <SosConfirmationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmSos}
        loading={loading}
      />
    </>
  );
}
