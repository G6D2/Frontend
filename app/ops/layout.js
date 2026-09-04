"use client";

import CityPassAppShell from "../components/CityPassAppShell";

export default function OpsLayout({ children }) {
  return <CityPassAppShell role="dispatcher">{children}</CityPassAppShell>;
}
