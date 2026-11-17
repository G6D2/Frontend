"use client";

import { useState, useEffect } from "react";
import {
  formatEmergencyLocation,
  reverseGeocode,
  resolveEmergencyAddress,
} from "../../lib/geocoding";

/**
 * Muestra la ubicación de una emergencia como texto entendible: dirección y
 * barrio, nunca latitud y longitud (ver formatEmergencyLocation).
 *
 * - Si el backend ya manda `address` (o el legado `locationLabel`), lo usa
 *   directamente: no geocodificamos de más (ver resolveEmergencyAddress).
 * - Si no hay dirección del backend pero sí coordenadas válidas: llama al
 *   BFF de geocodificación inversa y la muestra cuando llegue. Mientras
 *   tanto muestra el fallback.
 * - Si la geocodificación falla o no hay coords: el barrio o "Ubicación
 *   aproximada".
 *
 * Props:
 *   emergency      {object}  Objeto de emergencia del backend.
 *   fallback       {string}  Texto a mostrar mientras se geocodifica. Default: "Obteniendo dirección…"
 *   className      {string}  Clases CSS adicionales para el contenedor.
 */
export default function GeoLabel({
  emergency,
  fallback = "Obteniendo dirección…",
  className = "",
}) {
  const [resolvedGeo, setResolvedGeo] = useState(null);

  const lat = Number(emergency?.latitude);
  const lng = Number(emergency?.longitude);
  const { needsGeocode } = resolveEmergencyAddress(emergency);

  useEffect(() => {
    if (!needsGeocode) return;

    let cancelled = false;

    reverseGeocode(lat, lng).then((result) => {
      if (!cancelled) {
        setResolvedGeo({ lat, lng, address: result });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, needsGeocode]);

  const isCurrentResolved =
    resolvedGeo !== null &&
    resolvedGeo.lat === lat &&
    resolvedGeo.lng === lng;

  const resolving = needsGeocode && !isCurrentResolved;
  const displayText = resolving
    ? fallback
    : formatEmergencyLocation(emergency, isCurrentResolved ? resolvedGeo.address : null);

  return (
    <span className={className}>
      <span className={resolving ? "opacity-60" : ""}>{displayText}</span>
    </span>
  );
}
