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
    // "Estados" (kanban Mantine en /ops) se sacó del drawer; /ops redirige a
    // /ops/lista (ver app/ops/page.js), que ahora es el primer ítem.
    return "Lista";
  }

  if (pathname.startsWith("/mis-alertas")) return "Mis alertas";
  if (pathname.startsWith("/reportar")) return "Reportar";
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
