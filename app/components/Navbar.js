"use client";

import Image from "next/image";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconHome,
  IconBike,
  IconTrash,
  IconMessageReport,
  IconShieldExclamation,
  IconTrees,
  IconTheater,
  IconChartBar,
  IconUser,
  IconBell,
  IconSettings,
  IconHelpCircle,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import classes from "../styles.module.css";

const serviciosData = [
  { link: "", label: "Inicio", icon: IconHome },
  { link: "", label: "Movilidad", icon: IconBike },
  { link: "", label: "Residuos", icon: IconTrash },
  { link: "", label: "Reclamos", icon: IconMessageReport },
  { link: "", label: "Emergencias", icon: IconShieldExclamation },
  { link: "", label: "Espacios Públicos", icon: IconTrees },
  { link: "", label: "Cultura y Eventos", icon: IconTheater },
  { link: "", label: "Analítica Urbana", icon: IconChartBar },
];

const cuentaData = [
  { link: "", label: "Mi Cuenta", icon: IconUser },
  { link: "", label: "Notificaciones", icon: IconBell },
  { link: "", label: "Configuración", icon: IconSettings },
  { link: "", label: "Ayuda", icon: IconHelpCircle },
];

export default function Navbar({
  active,
  role,
  onNavClick,
  opened = true,
  onToggle,
}) {
  const serviciosLinks = serviciosData.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href={item.link}
      key={item.label}
      onClick={(event) => {
        event.preventDefault();
        onNavClick(item.label);
      }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>{item.label}</span>
    </a>
  ));

  const cuentaLinks = cuentaData.map((item) => (
    <a
      className={classes.link}
      data-active={
        item.label === "Mi Cuenta"
          ? undefined
          : item.label === active || undefined
      }
      href={item.link}
      key={item.label}
      onClick={(event) => {
        event.preventDefault();
        onNavClick(item.label);
      }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>
        {item.label === "Mi Cuenta"
          ? `Mi Cuenta (${
              role === "usuario"
                ? "Usuario"
                : role === "dispatcher"
                ? "Dispatcher"
                : "Oficial"
            })`
          : item.label}
      </span>
    </a>
  ));

  return (
    <>
      {/* ── Floating button when navbar is collapsed ── */}
      {!opened && onToggle && (
        <Tooltip label="Expandir menú" position="right" withArrow>
          <ActionIcon
            variant="filled"
            size="lg"
            radius="xl"
            onClick={onToggle}
            className={classes.navbarExpandFloatingBtn}
            aria-label="Expandir menú"
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* ── Main Navbar Sidebar ── */}
      <nav
        className={`${classes.navbar} ${!opened ? classes.navbarCollapsed : ""}`}
      >
        <div className={classes.navbarMain}>
          {/* ── Header with Logo and Collapse button ── */}
          <Group className={classes.header} justify="space-between" align="center">
            <Group gap="sm" align="center" style={{ flex: 1 }}>
              <Image
                src="/Images/CityPass_logo.png"
                alt="CityPass+ Logo"
                width={45}
                height={45}
                style={{ objectFit: "contain" }}
              />
              <span className={classes.brandName}>
                CityPass<span className={classes.brandPlus}>+</span>
              </span>
            </Group>

            {onToggle && (
              <Tooltip label="Ocultar menú" position="bottom" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  radius="md"
                  onClick={onToggle}
                  aria-label="Ocultar menú"
                >
                  <IconChevronLeft size={20} color="rgba(255,255,255,0.7)" />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          <div className={classes.sectionTitle}>Servicios</div>
          {serviciosLinks}

          <div className={classes.separator} />

          {cuentaLinks}
        </div>

        {/* ── la imagen rara de abajo del navbar ── */}
        {/* ── TODOS los width y los height estan a ojos
            ESO ESTA MAL, deberia preguntar en el canal de discord de Front para ver los datos
            reales de las medidas. Btw no se por q se borro esto ── */}
        <div className={classes.navbarFooterImage}>
          <Image
            src="/Images/CityPass_footer_navbar_image.png"
            alt="CityPass+"
            width={225}
            height={105}
            style={{ objectFit: "contain" }}
          />
        </div>
      </nav>
    </>
  );
}
