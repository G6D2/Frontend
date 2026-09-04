import MaterialIcon from "../../components/civic/MaterialIcon";

// TODO(back): GET /api/officers — listado real con status/zona (HU-06 / dashboard)
const OFFICERS = [
  { id: "u-14", name: "Unidad 14", zone: "Palermo", status: "disponible" },
  { id: "u-07", name: "Unidad 07", zone: "Recoleta", status: "disponible" },
  { id: "u-22", name: "Unidad 22", zone: "Almagro", status: "en_camino" },
  { id: "u-03", name: "Unidad 03", zone: "Belgrano", status: "disponible" },
  { id: "u-11", name: "Unidad 11", zone: "Centro", status: "ocupado" },
];

export default function OficialesPage() {
  // TODO(back): cargar con fetchOfficers() + auth dispatcher
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold text-primary mb-6">Oficiales</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {OFFICERS.map((o) => (
          <div
            key={o.id}
            className="bg-surface-container-lowest border border-outline-variant rounded p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
              {o.id.split("-")[1]}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-on-surface">{o.name}</div>
              <div className="text-xs text-on-surface-variant">{o.zone}</div>
            </div>
            <span
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
              style={{
                backgroundColor:
                  o.status === "disponible"
                    ? "color-mix(in srgb, var(--color-status-validada) 20%, transparent)"
                    : o.status === "en_camino"
                      ? "color-mix(in srgb, var(--color-status-despachada) 20%, transparent)"
                      : "color-mix(in srgb, var(--color-status-pendiente) 20%, transparent)",
                color:
                  o.status === "disponible"
                    ? "var(--color-status-validada)"
                    : o.status === "en_camino"
                      ? "var(--color-status-despachada)"
                      : "var(--color-status-pendiente)",
              }}
            >
              {o.status.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
