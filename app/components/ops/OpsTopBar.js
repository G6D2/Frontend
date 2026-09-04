"use client";

import { useEffect, useState } from "react";
import MaterialIcon from "../civic/MaterialIcon";
import { getStoredUser } from "../../lib/auth";

export default function OpsTopBar({ onMenuClick }) {
  // getStoredUser only on client after mount to avoid hydration mismatch
  const [initials, setInitials] = useState("OP");

  useEffect(() => {
    const user = getStoredUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitials((user?.username || "OP").slice(0, 2).toUpperCase());
  }, []);

  // TODO(back): notificaciones ops en vivo (HU-11) + estado Kafka/bus
  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[280px] z-40 flex items-center justify-between gap-2 px-3 sm:px-4 bg-surface border-b border-outline-variant h-12 lg:h-10">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuClick}
          className="lg:hidden min-w-touch min-h-touch flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high"
        >
          <MaterialIcon name="menu" />
        </button>
        <span className="text-base lg:text-xl font-bold text-primary truncate">
          CityPass Emergencias
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          {["notifications", "schedule", "wifi"].map((icon) => (
            <button
              key={icon}
              type="button"
              // TODO(back): cablear acciones reales (alertas, reloj turno, health)
              className="p-1 rounded text-on-surface-variant hover:bg-surface-container-high transition-all"
            >
              <MaterialIcon name={icon} size={20} />
            </button>
          ))}
        </div>
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold border border-outline-variant">
          {/* TODO(back): avatar/iniciales desde GET /api/user */}
          {initials}
        </div>
      </div>
    </header>
  );
}
