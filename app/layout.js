import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.module.css";

import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

export const metadata = {
  title: "CityPass+",
  description: "CityPass+ Frontend Application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
