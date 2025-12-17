"use client";
import { MantineProvider } from "@mantine/core";
import { AppStateProvider } from "@/contexts/AppStateContext";
import { theme } from "@/theme";
// Import Mantine styles BEFORE globals.css so our styles take precedence
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./globals.css";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <AppStateProvider>{children}</AppStateProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
