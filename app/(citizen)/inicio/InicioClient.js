"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  triggerPanicButton,
  getCurrentLocation,
  LocationError,
  getStoredUser,
  setStoredUser,
  fetchCurrentUser,
  ApiError,
} from "../../lib/api";
import { reverseGeocode } from "../../lib/geocoding";
import { ANTIPANIC_MODE } from "../../lib/features";
import {
  createSosController,
  SOS_COUNTDOWN_SECONDS,
  SOS_ADDRESS_TIMEOUT_MS,
} from "../../lib/sosController";

export default function InicioClient() {
  const router = useRouter();
  // Cargamos el perfil del usuario para leer el flag hasAntipanicButton
  const [user, setUser] = useState(getStoredUser());
  const [sosState, setSosState] = useState({
    phase: "idle",
    secondsLeft: SOS_COUNTDOWN_SECONDS,
    error: null,
    result: null,
  });
  const controllerRef = useRef(null);
  const cancelButtonRef = useRef(null);

  // Refresca usuario al montar el componente
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
  }, []);

  // La máquina de estados del SOS (cuenta regresiva + ubicación + dirección +
  // envío) vive en lib/sosController.js, sin React, para poder testearla con
  // timers falsos. Acá solo la instanciamos y reflejamos su estado.
  useEffect(() => {
    controllerRef.current = createSosController({
      getCurrentLocation,
      reverseGeocode: (lat, lng) =>
        reverseGeocode(lat, lng, { timeoutMs: SOS_ADDRESS_TIMEOUT_MS }),
      onSubmit: (location, address) =>
        triggerPanicButton({
          latitude: location.latitude,
          longitude: location.longitude,
          severity: "critical",
          emergencyType: "panic",
          address: address || undefined,
        }),
      onStateChange: setSosState,
    });
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  // Foco en "Cancelar" apenas arranca la cuenta regresiva (accesibilidad).
  useEffect(() => {
    if (sosState.phase === "counting") {
      cancelButtonRef.current?.focus();
    }
  }, [sosState.phase]);

  // Escape cancela la cuenta regresiva.
  useEffect(() => {
    if (sosState.phase !== "counting") return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") controllerRef.current?.cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sosState.phase]);

  // Éxito: misma confirmación que antes mostraba el modal (notificación +
  // redirección a la alerta creada).
  useEffect(() => {
    if (sosState.phase !== "success" || !sosState.result) return;
    notifications.show({
      title: "Alerta enviada",
      message:
        sosState.result.message ||
        "Tu ubicación fue compartida con las autoridades.",
      color: "red",
      autoClose: 4000,
    });
    router.push(`/mis-alertas/${sosState.result.emergencyId}`);
    controllerRef.current?.reset();
  }, [sosState.phase, sosState.result, router]);

  // Error: ubicación no disponible o falló el envío. Se avisa y se vuelve al
  // botón inicial sin haber llamado al backend (si fue error de ubicación) o
  // ya habiendo fallado la llamada (mensaje de ApiError si corresponde).
  useEffect(() => {
    if (!sosState.error) return;
    const isLocationErr =
      sosState.error instanceof LocationError ||
      sosState.error?.name === "LocationError" ||
      ["NOT_SUPPORTED", "PERMISSION_DENIED", "POSITION_UNAVAILABLE", "TIMEOUT"].includes(
        sosState.error?.code
      );

    notifications.show({
      title: isLocationErr ? "Error de ubicación" : "Error",
      message:
        sosState.error?.message || "No se pudo enviar la alerta. Intentá de nuevo.",
      color: "red",
      autoClose: 5000,
    });
  }, [sosState.error]);

  // IF principal: ¿tiene este usuario habilitado el Botón Antipánico?
  const canUseAntipanicButton = Boolean(user?.hasAntipanicButton);
  const counting = sosState.phase === "counting";
  const sending = sosState.phase === "sending";
  const countdownRatio = sosState.secondsLeft / SOS_COUNTDOWN_SECONDS;

  return (
    <>
      <CitizenTopBar title="Emergencias" />

      <CitizenPageContainer className="items-center pb-10">
        <div className="flex flex-col items-center justify-center mt-6 sm:mt-12 w-full">
          {canUseAntipanicButton ? (
            counting || sending ? (
              // ── Cuenta regresiva / envío en curso ──
              <div className="flex flex-col items-center gap-6 w-full">
                <div
                  aria-hidden="true"
                  className="w-64 h-64 rounded-full flex items-center justify-center transition-[background] duration-300"
                  style={{
                    background: `conic-gradient(var(--color-error) ${
                      sending ? 360 : countdownRatio * 360
                    }deg, rgba(186,26,26,0.15) 0deg)`,
                  }}
                >
                  <div className="w-56 h-56 rounded-full bg-error text-on-error flex flex-col items-center justify-center gap-1 shadow-[0_8px_32px_rgba(186,26,26,0.4)]">
                    <MaterialIcon name="emergency" filled size={40} />
                    <span className="text-5xl font-black tabular-nums leading-none mt-1">
                      {sending ? "…" : sosState.secondsLeft}
                    </span>
                  </div>
                </div>

                <p
                  aria-live="assertive"
                  aria-atomic="true"
                  className="text-base font-semibold text-on-surface text-center px-4"
                >
                  {sending
                    ? "Enviando alerta…"
                    : `Enviando en ${sosState.secondsLeft}… tocá Cancelar para no enviar.`}
                </p>

                <button
                  type="button"
                  ref={cancelButtonRef}
                  onClick={() => controllerRef.current?.cancel()}
                  disabled={sending}
                  className="w-full max-w-xs bg-surface text-primary font-semibold text-sm tracking-wide py-4 rounded-full min-h-[56px] border border-outline hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              // ── Botón Antipánico (visible solo para usuarios con el permiso habilitado) ──
              <>
                <button
                  id="btn-antipanico"
                  aria-label="Botón Antipánico"
                  onClick={() => controllerRef.current?.start()}
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
            )
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
                  reportar incidentes desde la sección Reportar.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 w-full">
          <button
            type="button"
            onClick={() => router.push("/reportar")}
            className="w-full flex items-center justify-center gap-2 bg-surface text-primary border border-outline px-6 py-4 rounded-xl font-semibold text-sm tracking-wide shadow-sm cursor-pointer hover:bg-surface-container hover:border-primary active:bg-surface-container-high transition-colors min-h-[56px]"
          >
            <MaterialIcon name="shield" size={20} />
            <span>Reportar un incidente</span>
          </button>
        </div>
      </CitizenPageContainer>
    </>
  );
}
