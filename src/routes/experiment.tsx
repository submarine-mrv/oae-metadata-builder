import { createFileRoute } from "@tanstack/react-router";
import ExperimentPage from "@/pages/experiment/ExperimentPage";
import ActivePageRedirect from "@/workspace/ActivePageRedirect";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/experiment")({
  component: () => (
    <RequireProject>
      <ActivePageRedirect page="experiment">
        <ExperimentPage />
      </ActivePageRedirect>
    </RequireProject>
  ),
});
