"use client";
import { MantineProvider } from "@mantine/core";
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
        <MantineProvider defaultColorScheme="light">{children}</MantineProvider>
      </body>
    </html>
  );
}
