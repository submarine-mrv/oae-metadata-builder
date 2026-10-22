import { Navigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { projectCountAtom } from "@/state/atoms";

/** Form routes need a project to edit; with none, the overview shows the welcome screen. */
export default function RequireProject({ children }: { children: React.ReactNode }) {
  if (useAtomValue(projectCountAtom) === 0) return <Navigate to="/overview" replace />;
  return <>{children}</>;
}
