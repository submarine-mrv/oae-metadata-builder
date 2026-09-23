import { createFileRoute } from "@tanstack/react-router";
import ProjectsPage from "@/pages/projects/ProjectsPage";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/projects")({
  component: () => (
    <RequireProject>
      <ProjectsPage />
    </RequireProject>
  ),
});
