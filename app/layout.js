import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

import { Inter, JetBrains_Mono } from "next/font/google";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import BackendWarmup from "./components/BackendWarmup";

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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <MantineProvider defaultColorScheme="light">
          <Notifications position="top-right" />
          <BackendWarmup />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
