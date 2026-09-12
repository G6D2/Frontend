"use client";

import CityPassAppShell from "../components/CityPassAppShell";
import BackendWaitingIndicator from "../components/civic/BackendWaitingIndicator";
import CitizenBottomNav from "../components/civic/CitizenBottomNav";

export default function CitizenLayout({ children }) {
  return (
    <CityPassAppShell role="usuario">
      <BackendWaitingIndicator />
      {/* La bottom bar es `fixed` (ver CitizenBottomNav) para no depender del
          scroll interno de `shellMain` (overflow: auto), que rompía el
          `sticky` en páginas más largas que la pantalla. El pb-24 reserva
          el espacio que ocupa esa barra fija en mobile para que no tape el
          contenido final de cada vista. */}
      <div className="min-h-screen bg-background text-on-background flex flex-col pb-24 lg:pb-0">
        {children}
      </div>
      <CitizenBottomNav />
    </CityPassAppShell>
  );
}
