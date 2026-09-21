import MaterialIcon from "../civic/MaterialIcon";

/**
 * Tarjeta mobile de una emergencia/incidente: badges (prioridad/estado) +
 * valor destacado a la derecha, renglón de ubicación con ícono, filas extra
 * opcionales (mismo patrón ícono + label + valor) y un pie con id/hora.
 *
 * La comparten /ops/lista y /ops/historial (antes cada una tenía su propia
 * tarjeta mobile con datos distintos a los de su tabla de escritorio; ahora
 * las dos vistas salen del mismo array de datos y de la misma config de
 * pills — PriorityBadge/StatusBadge de app/components/ops/OpsBadges.js).
 */
export default function EmergencyMobileCard({
  badges,
  headline,
  location,
  extraRows = [],
  idLabel,
  timeLabel,
  onClick,
  selected = false,
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-4 flex flex-col gap-3 transition-colors ${
        onClick ? "cursor-pointer active:bg-surface-container-low" : ""
      } ${selected ? "bg-surface-container-low border-l-4 border-l-secondary" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">{badges}</div>
        {headline != null && (
          <span className="font-mono text-xs font-bold text-on-surface-variant">
            {headline}
          </span>
        )}
      </div>

      {location && (
        <div className="flex items-center gap-2 text-sm text-on-surface">
          <MaterialIcon
            name="location_on"
            size={16}
            className="text-on-surface-variant shrink-0"
          />
          <span className="truncate">{location}</span>
        </div>
      )}

      {extraRows.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          {extraRows.map((row) => (
            <div
              key={row.label}
              className="flex items-start gap-2 text-sm text-on-surface"
            >
              <MaterialIcon
                name={row.icon}
                size={16}
                className="text-on-surface-variant mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-0.5">
                  {row.label}
                </span>
                <span className="block leading-snug">{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 mt-1 border-t border-outline-variant/60">
        <span className="font-mono flex items-center gap-1.5">{idLabel}</span>
        <span className="font-mono">{timeLabel}</span>
      </div>
    </div>
  );
}
