"use client";
import { MantineProvider } from "@mantine/core";
import { AppStateProvider } from "@/contexts/AppStateContext";
import SessionRestoreWrapper from "@/components/SessionRestoreWrapper";
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
          <AppStateProvider>
            <SessionRestoreWrapper>{children}</SessionRestoreWrapper>
          </AppStateProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
