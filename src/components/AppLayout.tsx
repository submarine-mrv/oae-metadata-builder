import { useDocumentTitle } from "@mantine/hooks";
import type React from "react";
import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAppState } from "@/contexts/AppStateContext";
import { projectDisplayName, UNNAMED_PROJECT } from "@/workspace/types";
import { useWorkspace } from "@/workspace/WorkspaceContext";

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
  const name = projectDisplayName(state);
  useDocumentTitle(
    name === UNNAMED_PROJECT ? "OAE Metadata Builder" : `${name} · OAE Metadata Builder`,
  );
  const projectOpen = useWorkspace().activeProjectId !== null;

  useEffect(() => {
    if (!projectOpen) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [projectOpen]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Navigation />
      {noScroll ? (
        // Children manage their own scrolling (e.g., form + sidebar layout)
        <main style={{ display: "flex", flex: 1, minHeight: 0 }}>{children}</main>
      ) : (
        // Standard scrollable content area
        <main style={{ flex: 1, overflow: "auto", minHeight: 0 }}>{children}</main>
      )}
    </div>
  );
}
