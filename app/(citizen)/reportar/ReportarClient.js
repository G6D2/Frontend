"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../components/civic/MaterialIcon";
import {
  reportIncident,
  getCurrentLocation,
  ApiError,
} from "../../lib/api";

// El último ítem (siempre "Otro") ocupa el ancho completo en la grilla de 2
// columnas de mobile cuando la cantidad de categorías es impar, sin
// hardcodear qué categoría es: se calcula por posición más abajo.
const CATEGORIES = [
  {
    value: "medical",
    label: "Emergencia médica",
    icon: "medical_services",
    emergency: true,
  },
  {
    value: "fire",
    label: "Incendio",
    icon: "local_fire_department",
    emergency: true,
  },
  {
    value: "infrastructure",
    label: "Infraestructura",
    icon: "construction",
    emergency: false,
  },
  {
    value: "disturbance",
    label: "Disturbio o evento",
    icon: "groups",
    emergency: false,
  },
  {
    value: "other",
    label: "Otro",
    icon: "more_horiz",
    emergency: false,
  },
];

export default function ReportarClient() {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || loading) return;
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      const result = await reportIncident({
        category: selected,
        latitude: location.latitude,
        longitude: location.longitude,
        description: description.trim() || undefined,
      });
      notifications.show({
        title: "Incidente reportado",
        message: result.message || "Tu reporte fue registrado.",
        color: "teal",
        autoClose: 4000,
      });
      router.push(`/mis-alertas/${result.emergencyId}`);
    } catch (err) {
      notifications.show({
        title: "Error",
        message:
          err instanceof ApiError
            ? err.message
            : "No se pudo reportar el incidente. Intentá de nuevo.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <CitizenTopBar title="Reportar incidente" />

      {/* pb-36 en mobile deja lugar al footer fijo + CitizenBottomNav (ambos
          `fixed`) para que no tapen el cuadro de aviso final del form. */}
      <CitizenPageContainer className="pt-6 pb-36 lg:pb-8">
        <div className="mb-4">
          <h2 className="text-2xl md:text-[32px] font-bold text-on-surface mb-2">
            ¿Qué está pasando?
          </h2>
          <p className="text-base text-on-surface-variant">
            Seleccioná la categoría y, si querés, agregá una descripción.
          </p>
        </div>

        <form
          id="report-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="incident-description"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="incident-description"
              name="description"
              rows={3}
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="Contá brevemente qué está pasando…"
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-base text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary outline-none resize-none"
            />
            <span className="text-xs text-on-surface-variant text-right">
              {description.length}/280
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map((cat, index) => {
              // En la grilla de 2 columnas de mobile, si la cantidad de
              // categorías es impar el último ítem (siempre "Otro", ver
              // arriba) ocupa el ancho completo para no dejar un hueco.
              const isLastOdd =
                index === CATEGORIES.length - 1 &&
                CATEGORIES.length % 2 === 1;
              return (
                <label
                  key={cat.value}
                  className={`relative cursor-pointer group ${isLastOdd ? "col-span-2 md:col-span-1" : ""}`}
                >
                  <input
                    type="radio"
                    name="incident_type"
                    value={cat.value}
                    checked={selected === cat.value}
                    onChange={() => setSelected(cat.value)}
                    className={`category-radio sr-only ${cat.emergency ? "emergency-radio" : ""}`}
                  />
                  <div className="h-full bg-surface rounded-xl border border-outline-variant p-4 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 hover:shadow-md min-h-[120px]">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        cat.emergency
                          ? "bg-error-container"
                          : "bg-surface-container-high"
                      }`}
                    >
                      <MaterialIcon
                        name={cat.icon}
                        size={28}
                        className={
                          cat.emergency ? "text-error" : "text-on-surface-variant"
                        }
                      />
                    </div>
                    <span className="text-sm font-semibold tracking-wide text-on-surface">
                      {cat.label}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </form>

        <div className="mt-8 p-4 bg-surface-container-low rounded-lg border border-outline-variant flex gap-4 items-start">
          <MaterialIcon
            name="info"
            className="text-on-surface-variant shrink-0"
          />
          <p className="text-base text-on-surface-variant">
            Si se trata de un riesgo inminente para la vida, por favor presione
            el botón de SOS o llame al 911 inmediatamente.
          </p>
        </div>
      </CitizenPageContainer>

      {/* fixed (no sticky) en mobile para no depender del scroll interno de
          shellMain, y bottom-20 para dejar el alto de CitizenBottomNav
          libre y no tapar el botón de enviar. */}
      <footer className="fixed inset-x-0 bottom-20 z-40 bg-surface border-t border-outline-variant px-4 py-4 pb-safe flex justify-end items-center shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)] lg:sticky lg:inset-x-auto lg:bottom-0">
        <div className="w-full flex justify-end">
          <button
            type="submit"
            form="report-form"
            disabled={!selected || loading}
            className="bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-full px-8 h-14 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando…" : "Reportar"}
            {!loading && <MaterialIcon name="arrow_forward" size={20} />}
          </button>
        </div>
      </footer>
    </>
  );
}
