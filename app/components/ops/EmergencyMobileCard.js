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
      className={`p-3 flex flex-col gap-2 transition-colors ${
        onClick ? "cursor-pointer active:bg-surface-container-low" : ""
      } ${selected ? "bg-surface-container-low border-l-4 border-l-secondary" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">{badges}</div>
        {headline != null && (
          <span className="font-mono text-xs font-bold text-on-surface-variant">
            {headline}
          </span>
        )}
      </div>

      {location && (
        <div className="flex items-center gap-1 text-xs text-on-surface">
          <MaterialIcon
            name="location_on"
            size={16}
            className="text-on-surface-variant shrink-0"
          />
          <span className="truncate">{location}</span>
        </div>
      )}

      {extraRows.map((row) => (
        <div
          key={row.label}
          className="flex items-start gap-1.5 text-xs text-on-surface"
        >
          <MaterialIcon
            name={row.icon}
            size={16}
            className="text-on-surface-variant mt-0.5 shrink-0"
          />
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
              {row.label}
            </span>
            <span className="block leading-snug">{row.value}</span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
        <span className="font-mono flex items-center gap-1.5">{idLabel}</span>
        <span className="font-mono">{timeLabel}</span>
      </div>
    </div>
  );
}
