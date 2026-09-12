import { redirect } from "next/navigation";

/**
 * El kanban Mantine (DispatcherView, antes montado acá) y /ops/lista son dos
 * tableros duplicados con estilos distintos. Por ahora /ops redirige a
 * /ops/lista; DispatcherView.js no se borra todavía (deuda técnica, ver PR).
 * El ítem "Estados" del drawer (Navbar.js/CityPassAppShell.js, no son
 * archivos de este PR) sigue apuntando a /ops: esta redirección lo resuelve.
 */
export default function OpsPage() {
  redirect("/ops/lista");
}
