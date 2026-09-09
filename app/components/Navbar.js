"use client";

import Image from "next/image";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconHome,
  IconMessageReport,
  IconShieldExclamation,
  IconLayoutKanban,
  IconList,
  IconMap,
  IconUsers,
  IconHistory,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import classes from "../styles.module.css";

const CITIZEN_NAV = [
  { label: "Inicio", icon: IconHome },
  { label: "Mis alertas", icon: IconShieldExclamation },
  { label: "Reclamos", icon: IconMessageReport },
  { label: "Mi Cuenta", icon: IconUser },
];

const DISPATCHER_NAV = [
  { label: "Estados", icon: IconLayoutKanban },
  { label: "Lista", icon: IconList },
  { label: "Mapa", icon: IconMap },
  { label: "Oficiales", icon: IconUsers },
  { label: "Historial", icon: IconHistory },
  { label: "Mi Cuenta", icon: IconUser },
];

export default function Navbar({
  active,
  role,
  onNavClick,
  opened = true,
  onToggle,
}) {
  const items = role === "dispatcher" ? DISPATCHER_NAV : CITIZEN_NAV;

  const links = items.map((item) => (
    <a
      className={classes.link}
      data-active={item.label === active || undefined}
      href="#"
      key={item.label}
      onClick={(event) => {
        event.preventDefault();
        onNavClick(item.label);
      }}
    >
      <item.icon className={classes.linkIcon} stroke={1.5} />
      <span>
        {item.label === "Mi Cuenta"
          ? `Mi Cuenta (${role === "usuario" ? "Usuario" : "Dispatcher"})`
          : item.label}
      </span>
    </a>
  ));

  const bottomLinks = items.map((item) => {
    const isActive = item.label === active;
    const isAccount = item.label === "Mi Cuenta";
    const label = isAccount ? "Cuenta" : item.label;

    return (
      <button
        key={item.label}
        type="button"
        className={classes.bottomNavLink}
        data-active={isActive || undefined}
        onClick={() => onNavClick(item.label)}
        aria-label={item.label}
      >
        <item.icon
          className={classes.bottomNavIcon}
          stroke={isActive ? 2.2 : 1.6}
        />
        <span className={classes.bottomNavLabel}>{label}</span>
      </button>
    );
  });

  return (
    <>
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

      {/* Desktop Sidebar Navbar */}
      <nav
        className={`${classes.navbar} ${!opened ? classes.navbarCollapsed : ""}`}
      >
        <div className={classes.navbarMain}>
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

          <div className={classes.sectionTitle}>Navegación</div>
          {links}
        </div>

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

      {/* Mobile Bottom Navbar */}
      <nav className={classes.bottomNavbar} aria-label="Navegación móvil">
        {bottomLinks}
      </nav>
    </>
  );
}
