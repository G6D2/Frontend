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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
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
