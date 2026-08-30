"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CitizenTopBar from "../../components/civic/CitizenTopBar";
import MaterialIcon from "../../components/civic/MaterialIcon";

const CATEGORIES = [
  // TODO(back): alinear valores de categoría con el contrato del backend (HU-02)
  {
    value: "medical",
    label: "Emergencia médica",
    icon: "medical_services",
    emergency: true,
    colSpan: "col-span-2 md:col-span-1",
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

  // TODO(back): flujo multi-paso + POST reportar (HU-02)
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    // TODO(back): pasos 2/3 + foto + payload < 256 KB + EmergenciaCreada
    router.push("/mis-alertas");
  };

  return (
    <>
      <CitizenTopBar
        title="Reportar"
        showBack
        backHref="/inicio"
        showClose
        onClose={() => router.push("/inicio")}
        showNotifications={false}
      />

      <main className="flex-1 mt-14 mb-24 px-4 md:px-12 md:max-w-[1280px] md:mx-auto w-full pt-6">
        <div className="mb-8" aria-label="Progreso del reporte: Paso 1 de 3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold tracking-wide text-primary">
              Paso 1: Tipo de incidente
            </span>
            <span className="text-xs font-medium text-on-surface-variant">
              1/3
            </span>
          </div>
          <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full w-1/3 transition-all duration-500" />
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl md:text-[32px] font-bold text-on-surface mb-2">
            ¿Qué está pasando?
          </h2>
          <p className="text-base text-on-surface-variant">
            Selecciona la categoría que mejor describa la situación actual.
          </p>
        </div>

        <form
          id="report-form"
          onSubmit={handleSubmit}
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          {CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              className={`relative cursor-pointer group ${cat.colSpan || ""}`}
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
          ))}
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
      </main>

      <footer className="fixed bottom-20 md:bottom-0 left-0 w-full z-40 bg-surface border-t border-outline-variant px-4 py-4 pb-safe flex justify-end items-center shadow-[0_-4px_12px_0_rgba(0,0,0,0.05)]">
        <div className="md:max-w-[1280px] md:mx-auto w-full flex justify-end">
          <button
            type="submit"
            form="report-form"
            disabled={!selected}
            className="bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-full px-8 h-14 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
            <MaterialIcon name="arrow_forward" size={20} />
          </button>
        </div>
      </footer>
    </>
  );
}
