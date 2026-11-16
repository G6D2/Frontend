import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

import { Inter, JetBrains_Mono } from "next/font/google";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import BackendWarmup from "./components/BackendWarmup";
import SessionRefreshManager from "./components/SessionRefreshManager";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata = {
  title: "CityPass Emergencias",
  description: "Sistema de emergencias ciudadanas - CityPass",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        {/* display=block y no swap: cada ícono es texto ("location_on") y con
            swap se leían las palabras hasta que bajaba la fuente. La regla
            google-font-display desaconseja block pensando en fuentes de
            texto; acá es una fuente de íconos. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <MantineProvider defaultColorScheme="light">
          <Notifications position="top-right" />
          <BackendWarmup />
          <SessionRefreshManager />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
