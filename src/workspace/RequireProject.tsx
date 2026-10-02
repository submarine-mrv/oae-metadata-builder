import { Navigate } from "@tanstack/react-router";
import type React from "react";
import { useWorkspace } from "./WorkspaceContext";

/** Form routes need a project to edit; with none, the overview shows the welcome screen. */
export default function RequireProject({ children }: { children: React.ReactNode }) {
  const { projects } = useWorkspace();
  if (projects.length === 0) return <Navigate to="/overview" replace />;
  return <>{children}</>;
}
