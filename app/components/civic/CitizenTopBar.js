"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Tooltip, Loader } from "@mantine/core";
import MaterialIcon from "./MaterialIcon";

export default function CitizenTopBar({
  title = "CityPass+ Emergencia",
  showBack = false,
  backHref = "/inicio",
  showClose = false,
  onClose,
  showMenu = false,
  showNotifications = true,
  hasNotificationDot = false,
}) {
  // Navegación principal vive en CityPassAppShell (Navbar OfficerView).
  const isDefaultBrand =
    !title ||
    title === "CityPass Emergencias" ||
    title === "CP+ Emergencia" ||
    title === "CityPass+ Emergencia" ||
    title === "Reportar";

  const renderTitleContent = () => {
    if (isDefaultBrand) {
      return (
        <>
          <span className="hidden sm:inline">
            CityPass<span style={{ color: "rgb(210, 152, 63)" }}>+</span> Emergencia
          </span>
          <span className="sm:hidden">
            CP<span style={{ color: "rgb(210, 152, 63)" }}>+</span> Emergencia
          </span>
        </>
      );
    }
    return title;
  };

  // ── Estado de geolocalización (loading | precise | imprecise) ──
  const [locStatus, setLocStatus] = useState("loading");

  const requestLocation = useCallback((forceFresh = false) => {
    if (forceFresh) {
      setLocStatus("loading");
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocStatus("imprecise");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocStatus("precise");
        if (typeof window !== "undefined") {
          window.__lastCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precise: true,
          };
          window.dispatchEvent(
            new CustomEvent("citypass:location-updated", {
              detail: window.__lastCoords,
            })
          );
        }
      },
      () => {
        setLocStatus("imprecise");
        if (typeof window !== "undefined") {
          window.__lastCoords = {
            latitude: -34.6037,
            longitude: -58.3816,
            precise: false,
          };
          window.dispatchEvent(
            new CustomEvent("citypass:location-updated", {
              detail: window.__lastCoords,
            })
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: forceFresh ? 0 : 30000,
      }
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestLocation(false);
  }, [requestLocation]);

  const statusLabel =
    locStatus === "loading"
      ? ". . ."
      : locStatus === "precise"
      ? "precisa"
      : "imprecisa";
  const tooltipText = `Ubicación ${statusLabel}`;

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-4 h-14 bg-surface border-b border-outline-variant pt-safe">
      <div className="flex items-center gap-1.5 min-w-[40px]">
        {showBack ? (
          <Link
            href={backHref}
            aria-label="Volver"
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="arrow_back" />
          </Link>
        ) : (
          <Tooltip
            label={tooltipText}
            position="bottom"
            withArrow
            events={{ hover: true, focus: true, touch: true }}
          >
            <button
              type="button"
              onClick={() => requestLocation(true)}
              title={tooltipText}
              aria-label={tooltipText}
              className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container active:bg-surface-container-high transition-colors"
            >
              {locStatus === "loading" ? (
                <Loader size={18} color="rgb(24, 36, 47)" />
              ) : locStatus === "precise" ? (
                <MaterialIcon
                  name="location_on"
                  filled
                  size={22}
                  style={{ color: "rgb(24, 36, 47)" }}
                />
              ) : (
                <MaterialIcon
                  name="location_on"
                  size={22}
                  style={{ color: "#94a3b8" }}
                />
              )}
            </button>
          </Tooltip>
        )}
      </div>

      {showBack || showMenu ? (
        <h1
          className={`text-base sm:text-xl font-bold text-primary truncate px-2 flex-1 ${
            showBack ? "text-center sm:text-left font-semibold" : "text-center"
          }`}
        >
          {renderTitleContent()}
        </h1>
      ) : (
        <span className="text-base sm:text-xl font-bold text-primary truncate px-2 flex-1 text-center sm:text-left">
          {renderTitleContent()}
        </span>
      )}

      <div className="flex items-center min-w-[44px] justify-end">
        {showClose ? (
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" />
          </button>
        ) : showNotifications ? (
          <button
            type="button"
            aria-label="Notificaciones"
            // TODO(back): panel de notificaciones / alertas del ciudadano (push o polling)
            className="min-w-touch min-h-touch flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors relative"
          >
            <MaterialIcon name="notifications" />
            {hasNotificationDot && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            )}
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>
    </header>
  );
}
