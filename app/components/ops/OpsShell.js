"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import OpsSidebar from "./OpsSidebar";
import OpsTopBar from "./OpsTopBar";

const OpsNavContext = createContext({
  open: false,
  openNav: () => {},
  closeNav: () => {},
  toggleNav: () => {},
});

export function useOpsNav() {
  return useContext(OpsNavContext);
}

export default function OpsShell({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const openNav = useCallback(() => setOpen(true), []);
  const closeNav = useCallback(() => setOpen(false), []);
  const toggleNav = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <OpsNavContext.Provider value={{ open, openNav, closeNav, toggleNav }}>
      <div className="bg-background text-on-background font-sans text-sm min-h-screen">
        <OpsSidebar open={open} onClose={closeNav} />
        <OpsTopBar onMenuClick={openNav} />
        <div className="lg:ml-[280px] mt-12 lg:mt-10 min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-2.5rem)]">
          {children}
        </div>
      </div>
    </OpsNavContext.Provider>
  );
}
