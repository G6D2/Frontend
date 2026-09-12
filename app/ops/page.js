import { redirect } from "next/navigation";

/**
 * El kanban Mantine (DispatcherView, antes montado acá) y /ops/lista son dos
 * tableros duplicados con estilos distintos. Por ahora /ops redirige a
 * /ops/lista; DispatcherView.js no se borra todavía (deuda técnica #64).
 * El drawer ya no tiene el ítem "Estados" (Navbar.js/CityPassAppShell.js):
 * esta redirección sigue existiendo por si algo apunta directo a /ops.
 */
export default function OpsPage() {
  redirect("/ops/lista");
}
