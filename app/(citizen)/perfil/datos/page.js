"use client";

import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../../components/civic/CitizenTopBar";
import {
  getPersonalData,
  savePersonalData,
  EMPTY_PERSONAL_DATA,
} from "../../../lib/personal-data";

const INPUT_CLASS =
  "h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all";

export default function DatosPersonalesPage() {
  const [form, setForm] = useState(EMPTY_PERSONAL_DATA);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(getPersonalData());
  }, []);

  const handleChange = (field) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const ok = savePersonalData(form);
    setSaving(false);
    notifications.show({
      title: ok ? "Guardado" : "No se pudo guardar",
      message: ok
        ? "Tus datos se guardaron en este dispositivo."
        : "Probá de nuevo en unos segundos.",
      color: ok ? "green" : "red",
    });
  };

  return (
    <>
      <CitizenTopBar showBack backHref="/perfil" title="Datos personales" />

      <main className="mx-auto w-full max-w-3xl p-4 md:p-8 flex flex-col gap-6">
        <p className="text-sm text-on-surface-variant">
          Estos datos ayudan a que, si activás el botón de pánico o reportás
          una emergencia, quien te asista tenga más contexto sobre vos.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6 bg-white rounded-xl border border-outline-variant p-4 md:p-6 shadow-ambient-lvl2"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="pd-name"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Nombre completo
            </label>
            <input
              id="pd-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Juan Pérez"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="pd-phone"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Teléfono
            </label>
            <input
              id="pd-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="11 2233 4455"
              className={INPUT_CLASS}
            />
          </div>

          <fieldset className="flex flex-col gap-4 border-t border-outline-variant pt-4">
            <legend className="text-sm font-semibold tracking-wide text-on-surface mb-1">
              Contacto de emergencia
            </legend>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="pd-ec-name"
                className="text-sm font-medium text-on-surface-variant"
              >
                Nombre del contacto
              </label>
              <input
                id="pd-ec-name"
                name="emergencyContactName"
                type="text"
                value={form.emergencyContactName}
                onChange={handleChange("emergencyContactName")}
                placeholder="Ana Pérez"
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="pd-ec-phone"
                className="text-sm font-medium text-on-surface-variant"
              >
                Teléfono del contacto
              </label>
              <input
                id="pd-ec-phone"
                name="emergencyContactPhone"
                type="tel"
                value={form.emergencyContactPhone}
                onChange={handleChange("emergencyContactPhone")}
                placeholder="11 9988 7766"
                className={INPUT_CLASS}
              />
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
            <label
              htmlFor="pd-medical"
              className="text-sm font-semibold tracking-wide text-on-surface"
            >
              Condición médica (opcional)
            </label>
            <input
              id="pd-medical"
              name="medicalCondition"
              type="text"
              maxLength={140}
              value={form.medicalCondition}
              onChange={handleChange("medicalCondition")}
              placeholder="Ej: diabetes, alergias, medicación habitual…"
              className={INPUT_CLASS}
            />
          </div>

          <p className="text-xs text-on-surface-variant italic">
            Se guarda solo en este dispositivo hasta que exista el perfil en
            el backend.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[52px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </main>
    </>
  );
}
