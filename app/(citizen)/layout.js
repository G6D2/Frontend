"use client";

import CityPassAppShell from "../components/CityPassAppShell";
import BackendWaitingIndicator from "../components/civic/BackendWaitingIndicator";
import CitizenBottomNav from "../components/civic/CitizenBottomNav";

export default function CitizenLayout({ children }) {
  return (
    <CityPassAppShell role="usuario">
      <BackendWaitingIndicator />
      <div className="min-h-screen bg-background text-on-background flex flex-col">
        {children}
        <CitizenBottomNav />
      </div>
    </CityPassAppShell>
  );
}
