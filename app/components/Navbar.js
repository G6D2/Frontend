"use client";

import Image from "next/image";
import { Group } from "@mantine/core";
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

export default function Navbar({ active, role, onNavClick }) {
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
          ? `Mi Cuenta (${role === "usuario" ? "Usuario" : "Dispatcher"})`
          : item.label}
      </span>
    </a>
  ));

  return (
    <nav className={classes.navbar}>
      <div className={classes.navbarMain}>
        {/* ── Logo ── */}
        <Group className={classes.header} gap="sm" align="center">
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

        <div className={classes.sectionTitle}>Servicios</div>
        {serviciosLinks}

        <div className={classes.separator} />

        {cuentaLinks}
      </div>

      {/* ── la imagen rara de abajo del navbar ── */}
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
  );
}
