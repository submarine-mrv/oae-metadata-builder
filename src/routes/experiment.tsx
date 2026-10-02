import { createFileRoute } from "@tanstack/react-router";
import ExperimentPage from "@/pages/experiment/ExperimentPage";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/experiment")({
  component: () => (
    <RequireProject>
      <ExperimentPage />
    </RequireProject>
  ),
});
