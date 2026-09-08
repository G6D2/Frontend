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
  getStoredUser,
  setStoredUser,
  fetchCurrentUser,
  ApiError,
} from "../../lib/api";
import { ANTIPANIC_MODE } from "../../lib/features";

export default function InicioClient() {
  const router = useRouter();
  // Cargamos el perfil del usuario para leer el flag hasAntipanicButton
  const [user, setUser] = useState(getStoredUser());
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("Obteniendo ubicación…");

  // Refresca usuario y geolocalización al montar el componente
  useEffect(() => {
    // En modo "mock": hasAntipanicButton viene del toggle del login y vive en sessionStorage.
    //   fetchCurrentUser() lo perdería (el backend no lo conoce), así que lo recuperamos del storage.
    // En modo "backend": hasAntipanicButton viene directamente del backend en la sesión fresca.
    //   fetchCurrentUser() ya lo trae; no necesitamos hacer nada especial.
    const savedAntipanicFlag =
      ANTIPANIC_MODE === "mock"
        ? (getStoredUser()?.hasAntipanicButton ?? false)
        : undefined; // en modo backend lo provee el backend

    fetchCurrentUser()
      .then((freshUser) => {
        const antipanicValue =
          ANTIPANIC_MODE === "mock"
            ? savedAntipanicFlag          // preservar el valor del toggle de login
            : (freshUser.hasAntipanicButton ?? false); // confiar en el backend
        const merged = { ...freshUser, hasAntipanicButton: antipanicValue };
        // Persistir el usuario fusionado en sessionStorage para que el flag
        // sobreviva las navegaciones entre páginas (fetchCurrentUser lo sobreescribía sin el flag).
        setStoredUser(merged);
        setUser(merged);
      })
      .catch(() => {}); // silencioso: si falla, seguimos con el usuario del storage

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

  // IF principal: ¿tiene este usuario habilitado el Botón Antipánico?
  const canUseAntipanicButton = Boolean(user?.hasAntipanicButton);

  return (
    <>
      <CitizenTopBar showMenu />

      <main className="flex-grow pb-24 lg:pb-8 px-4 md:px-12 max-w-[1280px] mx-auto w-full flex flex-col items-center justify-center relative min-h-[calc(100vh-3.5rem)]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 bg-tertiary-container text-on-tertiary-container px-4 py-2 rounded-full text-xs font-medium shadow-sm w-max max-w-full">
          <MaterialIcon name="location_on" size={16} />
          <span>{locationStatus}</span>
        </div>

        <div className="flex flex-col items-center justify-center mt-12 w-full max-w-sm">
          {canUseAntipanicButton ? (
            // ── Botón Antipánico (visible solo para usuarios con el permiso habilitado) ──
            <>
              <button
                id="btn-antipanico"
                aria-label="Botón Antipánico"
                onClick={() => setModalOpen(true)}
                className="pulse-sos bg-error text-on-error w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-[0_8px_32px_rgba(186,26,26,0.4)] active:scale-95 transition-transform duration-200"
              >
                <MaterialIcon name="emergency" filled size={64} className="mb-4" />
                <span className="text-2xl font-black uppercase tracking-widest text-center leading-tight px-4">
                  ANTIPANICO
                </span>
              </button>
              <p className="text-base text-on-surface-variant text-center mt-8 px-4">
                Envía una alerta de emergencia con tu ubicación actual.
              </p>
            </>
          ) : (
            // ── Sin acceso: usuario sin el permiso hasAntipanicButton ──
            <div
              id="no-antipanic-info"
              className="flex flex-col items-center gap-4 text-center px-4 py-8 rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm"
            >
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
                <MaterialIcon
                  name="emergency_home"
                  size={36}
                  className="text-on-surface-variant"
                />
              </div>
              <div>
                <p className="text-base font-semibold text-on-surface">
                  Botón Antipánico no habilitado
                </p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Tu cuenta no tiene acceso al Botón Antipánico. Podés
                  reportar incidentes desde la sección Reclamos.
                </p>
              </div>
            </div>
          )}
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
