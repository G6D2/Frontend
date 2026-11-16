"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navbar from "./Navbar";
import classes from "../styles.module.css";

const CITIZEN_ROUTES = {
  Inicio: "/inicio",
  "Mis alertas": "/mis-alertas",
  Reportar: "/reportar",
  "Mi Cuenta": "/perfil",
};

const DISPATCHER_ROUTES = {
  Estados: "/ops",
  Lista: "/ops/lista",
  Mapa: "/ops/mapa",
  Oficiales: "/ops/oficiales",
  Historial: "/ops/historial",
  "Analítica": "/ops/analitica",
  "Mi Cuenta": "/ops/cuenta",
};

const OFFICER_ROUTES = {
  Asignaciones: "/oficial",
  "Mi Cuenta": "/oficial/cuenta",
};

const ROUTES_BY_ROLE = {
  dispatcher: DISPATCHER_ROUTES,
  officer: OFFICER_ROUTES,
};

function resolveActive(pathname, role) {
  if (role === "officer") {
    return pathname.startsWith("/oficial/cuenta") ? "Mi Cuenta" : "Asignaciones";
  }

  if (role === "dispatcher") {
    if (pathname.startsWith("/ops/cuenta")) return "Mi Cuenta";
    if (pathname.startsWith("/ops/lista")) return "Lista";
    if (pathname.startsWith("/ops/historial")) return "Historial";
    if (pathname.startsWith("/ops/mapa")) return "Mapa";
    if (pathname.startsWith("/ops/oficiales")) return "Oficiales";
    if (pathname.startsWith("/ops/analitica")) return "Analítica";
    // /ops sin subruta = vista de Estados (kanban Mantine / DispatcherView)
    return "Estados";
  }

  if (pathname.startsWith("/mis-alertas")) return "Mis alertas";
  if (pathname.startsWith("/reportar")) return "Reportar";
  if (pathname.startsWith("/perfil")) return "Mi Cuenta";
  return "Inicio";
}

/**
 * Shell CityPass+ (Navbar lateral) para citizen, dispatcher y oficial.
 */
export default function CityPassAppShell({ role = "usuario", children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [opened, setOpened] = useState(true);
  const active = resolveActive(pathname, role);

  const handleNavClick = (label) => {
    const map = ROUTES_BY_ROLE[role] || CITIZEN_ROUTES;
    const href = map[label];
    if (href) {
      router.push(href);
    }
  };

  return (
    <div className={classes.shellContainer}>
      <Navbar
        active={active}
        role={role}
        onNavClick={handleNavClick}
        opened={opened}
        onToggle={() => setOpened((v) => !v)}
      />
      <main
        className={`${classes.shellMain} ${!opened ? classes.shellMainCollapsed : ""}`}
      >
        {children}
      </main>
    </div>
  );
}
