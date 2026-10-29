import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import OverviewPage from "@/pages/overview/OverviewPage";
import WelcomePage from "@/pages/welcome/WelcomePage";
import { activeProjectIdAtom, projectCountAtom } from "@/state/atoms";

function OverviewRoute() {
  const count = useAtomValue(projectCountAtom);
  const activeId = useAtomValue(activeProjectIdAtom);
  if (count === 0) return <WelcomePage />;
  return activeId ? <OverviewPage /> : <Navigate to="/projects" replace />;
}

export const Route = createFileRoute("/overview")({
  component: OverviewRoute,
});
