"use client";

import CityPassAppShell from "../components/CityPassAppShell";

export default function CitizenLayout({ children }) {
  return (
    <CityPassAppShell role="usuario">
      <div className="min-h-screen bg-background text-on-background flex flex-col">
        {children}
      </div>
    </CityPassAppShell>
  );
}
