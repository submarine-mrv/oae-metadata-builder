import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import ProjectsPage from "@/pages/projects/ProjectsPage";
import { projectCountAtom } from "@/state/atoms";

function ProjectsRoute() {
  return useAtomValue(projectCountAtom) === 0 ? (
    <Navigate to="/overview" replace />
  ) : (
    <ProjectsPage />
  );
}

export const Route = createFileRoute("/projects")({
  component: ProjectsRoute,
});
