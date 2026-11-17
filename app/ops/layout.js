"use client";

import CityPassAppShell from "../components/CityPassAppShell";
import BackendWaitingIndicator from "../components/civic/BackendWaitingIndicator";
import AlertaClimaticaBanner from "../components/ops/AlertaClimaticaBanner";

export default function OpsLayout({ children }) {
  return (
    <CityPassAppShell role="dispatcher">
      <BackendWaitingIndicator />
      <AlertaClimaticaBanner />
      {children}
    </CityPassAppShell>
  );
}
