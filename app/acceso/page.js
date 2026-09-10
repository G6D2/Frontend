import { Suspense } from "react";
import AccesoForm from "./AccesoForm";

/** Server Component. Si ya hay cookie válida, middleware redirige al home. */
export default function AccesoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-on-surface-variant text-sm">
          Cargando acceso…
        </div>
      }
    >
      <AccesoForm />
    </Suspense>
  );
}
