import { createFileRoute } from "@tanstack/react-router";
import OverviewPage from "@/pages/overview/OverviewPage";
import WelcomePage from "@/pages/welcome/WelcomePage";
import { useWorkspace } from "@/workspace/WorkspaceContext";

function OverviewRoute() {
  const { projects } = useWorkspace();
  return projects.length === 0 ? <WelcomePage /> : <OverviewPage />;
}

export const Route = createFileRoute("/overview")({
  component: OverviewRoute,
});
