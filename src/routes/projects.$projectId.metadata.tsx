import { createFileRoute } from "@tanstack/react-router";
import ProjectPage from "@/pages/project/ProjectPage";

export const Route = createFileRoute("/projects/$projectId/metadata")({
  component: ProjectPage,
});
