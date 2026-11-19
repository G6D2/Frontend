"use client";

import { useEffect } from "react";
import { installFetchWatcher, flush } from "../lib/report-429";

/**
 * Anota los 429 que el navegador recibe y que no pasaron por el servidor
 * (ver app/lib/report-429.js) y los manda a los logs cuando hay conexión.
 * Se monta una vez en el layout raíz.
 */
export default function Report429Watcher() {
  useEffect(() => {
    const uninstall = installFetchWatcher(window);
    const send = () => {
      flush(window, window.fetch).catch(() => {});
    };
    send();
    const onVisible = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      uninstall();
    };
  }, []);

  return null;
}
