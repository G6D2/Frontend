const MINOR_WORDS = new Set(["de", "del", "la", "las", "los", "y"]);

/**
 * Barrio del catálogo del backend (en mayúsculas) → texto para mostrar:
 * "PALERMO" → "Palermo", "VILLA DEL PARQUE" → "Villa del Parque".
 */
export function formatBarrio(barrio) {
  return barrio
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}
