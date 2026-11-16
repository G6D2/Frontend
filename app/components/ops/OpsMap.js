"use client";

import { useEffect, useRef, useState } from "react";
import { isOpsStatus } from "../../lib/api";
import {
  PRIORITY_CONFIG,
  getStatusConfig,
  hasValidCoords,
  getEffectivePriority,
  getIncidentSummary,
} from "../../lib/emergencies";

const CABA = [-34.6037, -58.3816];
const PRIORITY_HEX = {
  "priority-critical": "#b91c1c",
  "priority-high": "#f97316",
  "priority-med": "#ca8a04",
  "priority-low": "#3b82f6",
};
// Sin prioridad: gris, igual que el punto de priorityDotClass (antes caía
// en rojo, como si fuera crítica).
const NO_PRIORITY_HEX = "#6b7280";

function markerColor(severity) {
  return PRIORITY_HEX[PRIORITY_CONFIG[severity]?.color] || NO_PRIORITY_HEX;
}

/** Se pinta solo lo abierto y con coordenadas: nunca cerradas, canceladas ni
 * descartadas, aunque lleguen en la lista. */
function isMappable(em) {
  return hasValidCoords(em) && isOpsStatus(em?.status);
}

function markerHtml(color) {
  return `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}55,0 2px 8px rgba(0,0,0,.35)"></div>`;
}

function markerIcon(L, html) {
  return L.divIcon({
    className: "",
    html,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function OpsMap({ emergencies, selectedId, onSelect, flyTo }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const leafletRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const emergenciesRef = useRef(emergencies);
  const fittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line react-hooks/refs
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        CABA,
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    }

    init();

    return () => {
      cancelled = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;

    const mappable = emergencies.filter(isMappable);
    const nextIds = new Set(mappable.map((e) => e.id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const latLngs = [];
    mappable.forEach((em) => {
      const lat = Number(em.latitude);
      const lng = Number(em.longitude);
      latLngs.push([lat, lng]);
      const color = markerColor(getEffectivePriority(em));
      const status = getStatusConfig(em.status).label;
      const incident = getIncidentSummary(em);
      const incidentLine = incident?.reportCount
        ? `<br/><strong>Incidente</strong> · ${incident.reportCount} reporte${incident.reportCount === 1 ? "" : "s"}`
        : "";
      const html = markerHtml(color);

      let marker = markersRef.current.get(em.id);
      if (!marker) {
        marker = L.marker([lat, lng], { icon: markerIcon(L, html) }).addTo(map);
        marker.on("click", () => onSelectRef.current?.(em));
        markersRef.current.set(em.id, marker);
      } else {
        marker.setLatLng([lat, lng]);
        // La prioridad puede cambiar entre un polling y el siguiente: el
        // ícono se rearma solo si cambió el color, no en cada ciclo.
        if (marker.getIcon().options.html !== html) {
          marker.setIcon(markerIcon(L, html));
        }
      }

      marker.bindPopup(
        `<strong>${escapeHtml(em.description || "Emergencia")}</strong><br/>${status}<br/>${lat.toFixed(4)}, ${lng.toFixed(4)}${incidentLine}`
      );
    });

    if (!fittedRef.current && latLngs.length === 1) {
      map.setView(latLngs[0], 15);
      fittedRef.current = true;
    } else if (!fittedRef.current && latLngs.length > 1) {
      map.fitBounds(L.latLngBounds(latLngs).pad(0.2));
      fittedRef.current = true;
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [emergencies, mapReady]);

  // Declarado antes del efecto de selección: en un mismo render los efectos
  // corren en orden, así que ese ya lee la lista nueva.
  useEffect(() => {
    emergenciesRef.current = emergencies;
  }, [emergencies]);

  // Centra el mapa y abre el popup solo cuando cambia la selección. La lista
  // se lee del ref y no va en las dependencias: `emergencies` es un array
  // nuevo en cada polling (30 s) y el mapa volvía a la emergencia seleccionada
  // aunque el dispatcher lo hubiera movido.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selectedId) return;
    const em = emergenciesRef.current.find((e) => e.id === selectedId);
    if (!isMappable(em)) return;
    map.flyTo([Number(em.latitude), Number(em.longitude)], 16, {
      duration: 0.55,
    });
    markersRef.current.get(selectedId)?.openPopup();
  }, [selectedId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom || 15, { duration: 0.55 });
  }, [flyTo, mapReady]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
