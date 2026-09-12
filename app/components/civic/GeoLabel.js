"use client";

import { useState, useEffect } from "react";
import { reverseGeocode } from "../../lib/geocoding";
import { hasValidCoords, locationLabel } from "../../lib/emergencies";

/**
 * Muestra la ubicación de una emergencia como dirección humana.
 *
 * - Si la emergencia tiene coordenadas válidas: llama a Nominatim para obtener
 *   la dirección y la muestra cuando llegue. Mientras tanto muestra el fallback.
 * - Si el backend ya devuelve locationLabel (texto), lo usa directamente sin geocodificar.
 * - Si la ubicación está anonimizada o no hay coords: muestra el label existente.
 *
 * Props:
 *   emergency      {object}  Objeto de emergencia del backend.
 *   fallback       {string}  Texto a mostrar mientras se geocodifica. Default: "Obteniendo dirección…"
 *   showCoords     {boolean} Si true, muestra las coords debajo de la dirección (útil en ops). Default: false
 *   className      {string}  Clases CSS adicionales para el contenedor.
 */
export default function GeoLabel({
  emergency,
  fallback = "Obteniendo dirección…",
  showCoords = false,
  className = "",
}) {
  const [resolvedGeo, setResolvedGeo] = useState(null);

  const lat = Number(emergency?.latitude);
  const lng = Number(emergency?.longitude);
  const hasCoordsFlag = hasValidCoords(emergency);
  const anonymized = emergency?.locationAnonymized;
  const unavailable = emergency?.locationUnavailable;

  // Si el backend ya provee un label, la ubicación está anonimizada/no
  // disponible, o no hay coords válidas (lat/lng null ⇒ hasCoordsFlag
  // false), no geocodificamos. Antes acá se colaba (0,0) porque
  // Number(null) === 0 pasaba como "coords válidas".
  const backendLabel = emergency?.locationLabel;
  const skipGeocode =
    Boolean(backendLabel) || anonymized || unavailable || !hasCoordsFlag;

  useEffect(() => {
    if (skipGeocode) return;

    let cancelled = false;

    reverseGeocode(lat, lng).then((result) => {
      if (!cancelled) {
        setResolvedGeo({ lat, lng, address: result });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, skipGeocode]);

  const isCurrentResolved =
    resolvedGeo !== null &&
    resolvedGeo.lat === lat &&
    resolvedGeo.lng === lng;

  const resolving = !skipGeocode && !isCurrentResolved;
  const address = isCurrentResolved ? resolvedGeo.address : null;

  // ── Determinar el texto a mostrar ──
  let displayText;
  if (anonymized) {
    displayText = "Ubicación anonimizada";
  } else if (unavailable) {
    displayText = "Sin ubicación";
  } else if (backendLabel) {
    displayText = backendLabel;
  } else if (address) {
    displayText = address;
  } else if (resolving) {
    displayText = fallback;
  } else {
    // Geocodificación falló o no hay coords: mostrar lat/lng como último recurso
    displayText = locationLabel(emergency);
  }

  const coordsText =
    showCoords && hasCoordsFlag && !anonymized
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : null;

  return (
    <span className={className}>
      <span className={resolving ? "opacity-60" : ""}>{displayText}</span>
      {coordsText && (
        <span className="block text-xs text-on-surface-variant/70 font-mono mt-0.5">
          {coordsText}
        </span>
      )}
    </span>
  );
}
