import { createFileRoute } from "@tanstack/react-router";
import ExperimentPage from "@/pages/experiment/ExperimentPage";
import { ExperimentRoute } from "@/workspace/EntityRoutes";

export const Route = createFileRoute("/projects/$projectId/experiments/$experimentId")({
  component: () => (
    <ExperimentRoute>
      <ExperimentPage />
    </ExperimentRoute>
  ),
});
