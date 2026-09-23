"use client";

import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../../components/civic/CitizenPageContainer";
import {
  getPersonalData,
  savePersonalData,
  EMPTY_PERSONAL_DATA,
} from "../../../lib/personal-data";
import { CitizenProfileApiError } from "../../../lib/citizen-profile-api.js";

const INPUT_CLASS =
  "h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all";

export default function DatosPersonalesPage() {
  const [form, setForm] = useState(EMPTY_PERSONAL_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPersonalData();
        if (!cancelled) setForm(data);
      } catch (err) {
        if (!cancelled) {
          notifications.show({
            title: "No se pudo cargar el perfil",
            message: err instanceof CitizenProfileApiError ? err.message : "Reintentá en unos segundos.",
            color: "red",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await savePersonalData(form);
      notifications.show({
        title: "Guardado",
        message: "Tu perfil quedó en el servidor (datos sensibles cifrados).",
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "No se pudo guardar",
        message: err instanceof CitizenProfileApiError ? err.message : "Probá de nuevo en unos segundos.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CitizenTopBar showBack backHref="/perfil" title="Datos personales" />

      <CitizenPageContainer>
        <p className="text-sm text-on-surface-variant">
          Estos datos ayudan a que, si activás el botón de pánico o reportás
          una emergencia, quien te asista tenga más contexto sobre vos.
        </p>
        <p className="text-xs text-on-surface-variant">
          Se guardan en el backend con cifrado en reposo. No se almacenan en
          localStorage del navegador.
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
              disabled={loading || saving}
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
              disabled={loading || saving}
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
                disabled={loading || saving}
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
                disabled={loading || saving}
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
              disabled={loading || saving}
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={loading || saving}
            className="min-h-[52px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </CitizenPageContainer>
    </>
  );
}
