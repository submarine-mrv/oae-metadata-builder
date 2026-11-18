import { createFileRoute } from "@tanstack/react-router";
import { ProjectRoute } from "@/workspace/EntityRoutes";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectRoute,
});
