"use client";

import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import CitizenTopBar from "../../../components/civic/CitizenTopBar";
import CitizenPageContainer from "../../../components/civic/CitizenPageContainer";
import MaterialIcon from "../../../components/civic/MaterialIcon";
import {
  getSavedLocations,
  addSavedLocation,
  updateSavedLocation,
  removeSavedLocation,
} from "../../../lib/saved-locations";
import { CitizenProfileApiError } from "../../../lib/citizen-profile-api.js";

const INPUT_CLASS =
  "h-12 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim outline-none transition-all";

const LABEL_PRESETS = ["Casa", "Trabajo", "Otro"];

const EMPTY_FORM = { labelPreset: "Casa", customLabel: "", address: "", lat: "", lng: "" };

function formatCoords(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function UbicacionesGuardadasPage() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getSavedLocations();
        if (!cancelled) setLocations(list);
      } catch (err) {
        if (!cancelled) {
          notifications.show({
            title: "No se pudieron cargar las ubicaciones",
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

  const resolvedNewLabel =
    form.labelPreset === "Otro" ? form.customLabel : form.labelPreset;

  const handleUseCurrentLocation = () => {
    setGeoError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Este dispositivo no puede compartir tu ubicación. Completá la dirección a mano.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setForm((prev) => ({
          ...prev,
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        }));
      },
      () => {
        setGeoLoading(false);
        setGeoError("No pudimos obtener tu ubicación. Completá la dirección a mano.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!resolvedNewLabel.trim() || !form.address.trim()) {
      notifications.show({
        title: "Faltan datos",
        message: "Poné un nombre y una dirección para guardar la ubicación.",
        color: "red",
      });
      return;
    }
    try {
      const entry = await addSavedLocation({
        label: resolvedNewLabel.trim(),
        address: form.address.trim(),
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
      });
      if (!entry) {
        throw new Error("empty");
      }
      setLocations((prev) => [...prev, entry]);
      setForm(EMPTY_FORM);
      setGeoError("");
      notifications.show({
        title: "Guardado",
        message: `"${entry.label}" se agregó en el servidor.`,
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "No se pudo guardar",
        message: err instanceof CitizenProfileApiError ? err.message : "Probá de nuevo en unos segundos.",
        color: "red",
      });
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditForm({
      label: loc.label,
      address: loc.address,
      lat: loc.lat ?? "",
      lng: loc.lng ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (id) => {
    try {
      await updateSavedLocation(id, {
        label: editForm.label.trim(),
        address: editForm.address.trim(),
        lat: editForm.lat === "" ? null : Number(editForm.lat),
        lng: editForm.lng === "" ? null : Number(editForm.lng),
      });
      setLocations(await getSavedLocations());
      notifications.show({ title: "Guardado", message: "Ubicación actualizada en el servidor.", color: "green" });
      cancelEdit();
    } catch (err) {
      notifications.show({
        title: "No se pudo guardar",
        message: err instanceof CitizenProfileApiError ? err.message : "Probá de nuevo en unos segundos.",
        color: "red",
      });
    }
  };

  const handleDelete = async (loc) => {
    try {
      await removeSavedLocation(loc.id);
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
      notifications.show({ title: "Eliminada", message: `"${loc.label}" se borró.`, color: "gray" });
    } catch (err) {
      notifications.show({
        title: "No se pudo eliminar",
        message: err instanceof CitizenProfileApiError ? err.message : "Probá de nuevo en unos segundos.",
        color: "red",
      });
    }
  };

  return (
    <>
      <CitizenTopBar showBack backHref="/perfil" title="Ubicaciones guardadas" />

      <CitizenPageContainer>
        <p className="text-sm text-on-surface-variant">
          Lugares frecuentes (casa, trabajo) para elegirlos rápido más adelante.
        </p>
        <p className="text-xs text-on-surface-variant">
          Se guardan en el backend con cifrado en reposo. No se almacenan en
          localStorage del navegador.
        </p>

        {loading && (
          <p className="text-sm text-on-surface-variant">Cargando ubicaciones…</p>
        )}

        {!loading && locations.length > 0 && (
          <section className="flex flex-col gap-3">
            {locations.map((loc) =>
              editingId === loc.id ? (
                <div
                  key={loc.id}
                  className="bg-white rounded-xl border border-primary p-4 flex flex-col gap-3 shadow-ambient-lvl2"
                >
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`edit-label-${loc.id}`} className="text-xs font-semibold text-on-surface-variant">
                      Nombre
                    </label>
                    <input
                      id={`edit-label-${loc.id}`}
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, label: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`edit-address-${loc.id}`} className="text-xs font-semibold text-on-surface-variant">
                      Dirección
                    </label>
                    <input
                      id={`edit-address-${loc.id}`}
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-2">
                      <label htmlFor={`edit-lat-${loc.id}`} className="text-xs font-semibold text-on-surface-variant">
                        Latitud (opcional)
                      </label>
                      <input
                        id={`edit-lat-${loc.id}`}
                        type="number"
                        step="any"
                        value={editForm.lat}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, lat: e.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor={`edit-lng-${loc.id}`} className="text-xs font-semibold text-on-surface-variant">
                        Longitud (opcional)
                      </label>
                      <input
                        id={`edit-lng-${loc.id}`}
                        type="number"
                        step="any"
                        value={editForm.lng}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, lng: e.target.value }))}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="h-10 px-4 rounded-lg font-semibold text-sm border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(loc.id)}
                      className="h-10 px-4 rounded-lg font-semibold text-sm bg-primary text-on-primary hover:opacity-90 cursor-pointer transition-opacity"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={loc.id}
                  className="bg-white rounded-xl border border-outline-variant p-4 flex items-start gap-4 shadow-ambient-lvl2"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <MaterialIcon name="location_on" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-on-surface">{loc.label}</p>
                    <p className="text-sm text-on-surface-variant break-words">{loc.address}</p>
                    {formatCoords(loc.lat, loc.lng) && (
                      <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                        {formatCoords(loc.lat, loc.lng)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Editar ${loc.label}`}
                      onClick={() => startEdit(loc)}
                      className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container-low text-on-surface-variant cursor-pointer transition-colors"
                    >
                      <MaterialIcon name="edit" size={20} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Borrar ${loc.label}`}
                      onClick={() => handleDelete(loc)}
                      className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-error-container text-error cursor-pointer transition-colors"
                    >
                      <MaterialIcon name="delete" size={20} />
                    </button>
                  </div>
                </div>
              )
            )}
          </section>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-4 bg-white rounded-xl border border-outline-variant p-4 md:p-6 shadow-ambient-lvl2"
        >
          <h2 className="text-sm font-semibold text-on-surface">Agregar ubicación</h2>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-on-surface-variant">Nombre</span>
            <div className="grid grid-cols-3 gap-2">
              {LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, labelPreset: preset }))}
                  aria-pressed={form.labelPreset === preset}
                  className={`h-10 rounded-lg text-sm font-semibold cursor-pointer transition-colors border ${
                    form.labelPreset === preset
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            {form.labelPreset === "Otro" && (
              <input
                type="text"
                value={form.customLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, customLabel: e.target.value }))}
                placeholder="Ej: Casa de mis padres"
                aria-label="Nombre de la ubicación"
                className={INPUT_CLASS}
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="new-address" className="text-sm font-medium text-on-surface-variant">
              Dirección
            </label>
            <input
              id="new-address"
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Av. Siempre Viva 742"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              className="h-11 px-4 rounded-lg font-semibold text-sm border border-outline-variant text-primary hover:bg-surface-container-low cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <MaterialIcon name="my_location" size={18} />
              {geoLoading ? "Buscando ubicación..." : "Usar mi ubicación actual"}
            </button>
            {geoError && <p className="text-xs text-error">{geoError}</p>}
            {(form.lat !== "" || form.lng !== "") && !geoError && (
              <p className="text-xs text-on-surface-variant font-mono">
                {form.lat}, {form.lng}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="min-h-[48px] py-3 px-4 w-full bg-primary text-on-primary font-semibold text-sm tracking-wide rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Guardar ubicación
          </button>
        </form>
      </CitizenPageContainer>
    </>
  );
}
