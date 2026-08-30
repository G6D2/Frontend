import { redirect } from "next/navigation";

// TODO(back): vista dedicada de cola de emergencias (filtros HU-07) en lugar de redirect
export default function OpsEmergenciasPage() {
  redirect("/ops");
}
