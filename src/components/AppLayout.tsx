"use client";
import React, { useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAppState } from "@/contexts/AppStateContext";

interface AppLayoutProps {
  children: React.ReactNode;
  /** When true, children manage their own scrolling (e.g., form pages with sidebars) */
  noScroll?: boolean;
}

/**
 * AppLayout provides consistent page structure across the application:
 * - Fixed navigation bar at top
 * - Scrollable content area below
 * - Prevents body scroll to eliminate jitter during hydration
 */
export default function AppLayout({ children, noScroll = false }: AppLayoutProps) {
  const { state } = useAppState();
  const hasContent =
    state.hasProject ||
    state.experiments.length > 0 ||
    state.datasets.length > 0;

  useEffect(() => {
    if (!hasContent) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasContent]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <Navigation />
      {noScroll ? (
        // Children manage their own scrolling (e.g., form + sidebar layout)
        <main style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {children}
        </main>
      ) : (
        // Standard scrollable content area
        <main style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {children}
        </main>
      )}
    </div>
  );
}
