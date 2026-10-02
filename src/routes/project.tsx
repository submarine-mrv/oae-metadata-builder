import { createFileRoute } from "@tanstack/react-router";
import ProjectPage from "@/pages/project/ProjectPage";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/project")({
  component: () => (
    <RequireProject>
      <ProjectPage />
    </RequireProject>
  ),
});
