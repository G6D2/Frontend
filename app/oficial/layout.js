"use client";

import CityPassAppShell from "../components/CityPassAppShell";
import BackendWaitingIndicator from "../components/civic/BackendWaitingIndicator";

export default function OficialLayout({ children }) {
  return (
    <CityPassAppShell role="officer">
      <BackendWaitingIndicator />
      {children}
    </CityPassAppShell>
  );
}
