import { Navigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { activeProjectIdAtom, projectCountAtom } from "@/state/atoms";

/** Form routes need a project to edit; with none, the overview shows the welcome screen. */
export default function RequireProject({ children }: { children: React.ReactNode }) {
  const count = useAtomValue(projectCountAtom);
  const activeId = useAtomValue(activeProjectIdAtom);
  if (count === 0) return <Navigate to="/overview" replace />;
  if (!activeId) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}
