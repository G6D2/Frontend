"use client";

import CityPassAppShell from "../components/CityPassAppShell";
import BackendWaitingIndicator from "../components/civic/BackendWaitingIndicator";

export default function OpsLayout({ children }) {
  return (
    <CityPassAppShell role="dispatcher">
      <BackendWaitingIndicator />
      {children}
    </CityPassAppShell>
  );
}
