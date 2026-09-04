"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navbar from "./Navbar";

const CITIZEN_ROUTES = {
  Inicio: "/inicio",
  "Mis alertas": "/mis-alertas",
  Reclamos: "/reportar",
  "Mi Cuenta": "/perfil",
};

const DISPATCHER_ROUTES = {
  Kanban: "/ops",
  Lista: "/ops/lista",
  Mapa: "/ops/mapa",
  Oficiales: "/ops/oficiales",
  Historial: "/ops/historial",
  "Mi Cuenta": "/ops/cuenta",
};

function resolveActive(pathname, role) {
  if (role === "dispatcher") {
    if (pathname.startsWith("/ops/cuenta")) return "Mi Cuenta";
    if (pathname.startsWith("/ops/lista")) return "Lista";
    if (pathname.startsWith("/ops/historial")) return "Historial";
    if (pathname.startsWith("/ops/mapa")) return "Mapa";
    if (pathname.startsWith("/ops/oficiales")) return "Oficiales";
    return "Kanban";
  }

  if (pathname.startsWith("/mis-alertas")) return "Mis alertas";
  if (pathname.startsWith("/reportar")) return "Reclamos";
  if (pathname.startsWith("/perfil")) return "Mi Cuenta";
  return "Inicio";
}

/**
 * Shell CityPass+ (Navbar lateral de OfficerView) para citizen y dispatcher.
 */
export default function CityPassAppShell({ role = "usuario", children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, setOpened] = useState(true);
  const active = resolveActive(pathname, role);

  const handleNavClick = (label) => {
    const map = role === "dispatcher" ? DISPATCHER_ROUTES : CITIZEN_ROUTES;
    const href = map[label];
    if (href) {
      router.push(href);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        position: "relative",
        backgroundColor: "#ffffff",
      }}
    >
      <Navbar
        active={active}
        role={role}
        onNavClick={handleNavClick}
        opened={opened}
        onToggle={() => setOpened((v) => !v)}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          overflow: "auto",
          position: "relative",
          paddingLeft: !opened ? 48 : 0,
          transition: "padding 220ms ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}
