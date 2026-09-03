"use client";

import { useState } from "react";
import { notifications } from "@mantine/notifications";
import Navbar from "./components/Navbar";
import PanicButton from "./components/PanicButton";
import DispatcherView from "./components/DispatcherView";
import OfficerView from "./components/OfficerView";

export default function Home() {
  const [active, setActive] = useState("Emergencias");
  const [role, setRole] = useState("usuario"); // "usuario" | "dispatcher" | "oficial"
  const [navbarOpened, setNavbarOpened] = useState(true);

  // ── Role rotation via "Mi Cuenta": Usuario -> Dispatcher -> Oficial -> Usuario ──
  const handleNavClick = (label) => {
    if (label === "Mi Cuenta") {
      let newRole = "usuario";
      if (role === "usuario") newRole = "dispatcher";
      else if (role === "dispatcher") newRole = "oficial";
      else if (role === "oficial") newRole = "usuario";

      setRole(newRole);
      const roleDisplayName =
        newRole === "usuario"
          ? "Usuario"
          : newRole === "dispatcher"
          ? "Dispatcher"
          : "Oficial en Terreno";

      notifications.show({
        title: "Rol cambiado",
        message: `Viendo como: ${roleDisplayName}`,
        color: "blue",
        autoClose: 2000,
      });
      return;
    }
    setActive(label);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      <Navbar
        active={active}
        role={role}
        onNavClick={handleNavClick}
        opened={navbarOpened}
        onToggle={() => setNavbarOpened((prev) => !prev)}
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: role === "usuario" ? "center" : "flex-start",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          overflow: "auto",
          minWidth: 0,
          paddingLeft: !navbarOpened ? "48px" : 0,
          transition: "padding 220ms ease",
        }}
      >
        {role === "usuario" ? (
          <PanicButton />
        ) : role === "dispatcher" ? (
          <DispatcherView />
        ) : (
          <OfficerView />
        )}
      </main>
    </div>
  );
}
