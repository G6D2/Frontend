import MaterialIcon from "../../components/civic/MaterialIcon";
import { formatTimeShort } from "../../lib/emergencies";

// TODO(back): HU-07 — GET emergencias CERRADA/CANCELLED/DISCARDED (no mock)
const HISTORY = [
  { id: "em-h01", type: "Médica", location: "Villa Crespo", status: "resuelta", time: "2026-08-28T18:00:00-03:00" },
  { id: "em-h02", type: "Incendio", location: "San Telmo", status: "resuelta", time: "2026-08-27T09:30:00-03:00" },
  { id: "em-h03", type: "Disturbio", location: "La Boca", status: "descartada", time: "2026-08-26T22:15:00-03:00" },
];

export default function HistorialPage() {
  // TODO(back): fetchEmergencies filtrado por estados finales + auth dispatcher
  return (
    <main className="p-4 max-w-4xl">
      <h1 className="text-xl font-bold text-primary mb-6">Historial</h1>
      <table className="w-full text-left border-collapse bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
        <thead className="bg-surface-container">
          <tr>
            {["ID", "Tipo", "Ubicación", "Estado", "Hora"].map((h) => (
              <th
                key={h}
                className="p-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-xs">
          {HISTORY.map((row) => (
            <tr
              key={row.id}
              className="border-b border-outline-variant/50 hover:bg-surface-container-low"
            >
              <td className="p-3 font-mono">{row.id}</td>
              <td className="p-3 font-bold">{row.type}</td>
              <td className="p-3">{row.location}</td>
              <td className="p-3">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor:
                      row.status === "resuelta"
                        ? "color-mix(in srgb, var(--color-status-validada) 20%, transparent)"
                        : "color-mix(in srgb, var(--color-status-pendiente) 20%, transparent)",
                    color:
                      row.status === "resuelta"
                        ? "var(--color-status-validada)"
                        : "var(--color-status-pendiente)",
                  }}
                >
                  {row.status}
                </span>
              </td>
              <td className="p-3 font-mono">{formatTimeShort(row.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
