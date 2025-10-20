"use client";
import { MantineProvider } from "@mantine/core";
import { AppStateProvider } from "@/contexts/AppStateContext";
import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MantineProvider defaultColorScheme="light">
          <AppStateProvider>{children}</AppStateProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
