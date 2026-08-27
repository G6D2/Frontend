"use client";

import { useState } from "react";
import { notifications } from "@mantine/notifications";
import Navbar from "./components/Navbar";
import PanicButton from "./components/PanicButton";
import DispatcherView from "./components/DispatcherView";

export default function Home() {
  const [active, setActive] = useState("Emergencias");
  const [role, setRole] = useState("usuario"); // "usuario" | "dispatcher"

  // ── Role toggle via "Mi Cuenta" ──
  const handleNavClick = (label) => {
    if (label === "Mi Cuenta") {
      const newRole = role === "usuario" ? "dispatcher" : "usuario";
      setRole(newRole);
      notifications.show({
        title: "Role changed",
        message: `Now viewing as: ${newRole === "usuario" ? "Usuario" : "Dispatcher"}`,
        color: "blue",
        autoClose: 2000,
      });
      return;
    }
    setActive(label);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Navbar active={active} role={role} onNavClick={handleNavClick} />

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: role === "dispatcher" ? "flex-start" : "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          overflow: "auto",
        }}
      >
        {role === "usuario" ? <PanicButton /> : <DispatcherView />}
      </main>
    </div>
  );
}
