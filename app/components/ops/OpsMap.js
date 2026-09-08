"use client";

import { useEffect, useRef, useState } from "react";
import { PRIORITY_CONFIG, getStatusConfig } from "../../lib/emergencies";

const CABA = [-34.6037, -58.3816];
const PRIORITY_HEX = {
  "priority-high": "#b91c1c",
  "priority-med": "#f97316",
  "priority-low": "#3b82f6",
};

function markerColor(severity) {
  const cfg = PRIORITY_CONFIG[severity] || PRIORITY_CONFIG.critical;
  return PRIORITY_HEX[cfg.color] || "#b91c1c";
}

function hasCoords(em) {
  return (
    !em?.locationAnonymized &&
    Number.isFinite(Number(em?.latitude)) &&
    Number.isFinite(Number(em?.longitude))
  );
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

    const nextIds = new Set(emergencies.filter(hasCoords).map((e) => e.id));
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    const latLngs = [];
    emergencies.forEach((em) => {
      if (!hasCoords(em)) return;
      const lat = Number(em.latitude);
      const lng = Number(em.longitude);
      latLngs.push([lat, lng]);
      const color = markerColor(em.severity);
      const status = getStatusConfig(em.status).label;
      const html = `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}55,0 2px 8px rgba(0,0,0,.35)"></div>`;

      let marker = markersRef.current.get(em.id);
      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(map);
        marker.on("click", () => onSelectRef.current?.(em));
        markersRef.current.set(em.id, marker);
      } else {
        marker.setLatLng([lat, lng]);
      }

      marker.bindPopup(
        `<strong>${escapeHtml(em.description || "Emergencia")}</strong><br/>${status}<br/>${lat.toFixed(4)}, ${lng.toFixed(4)}`
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

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selectedId) return;
    const em = emergencies.find((e) => e.id === selectedId);
    if (!hasCoords(em)) return;
    map.flyTo([Number(em.latitude), Number(em.longitude)], 16, {
      duration: 0.55,
    });
    markersRef.current.get(selectedId)?.openPopup();
  }, [selectedId, emergencies, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom || 15, { duration: 0.55 });
  }, [flyTo, mapReady]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
