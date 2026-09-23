import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import OverviewPage from "@/pages/overview/OverviewPage";
import WelcomePage from "@/pages/welcome/WelcomePage";
import { projectCountAtom } from "@/state/atoms";

function OverviewRoute() {
  return useAtomValue(projectCountAtom) === 0 ? <WelcomePage /> : <OverviewPage />;
}

export const Route = createFileRoute("/overview")({
  component: OverviewRoute,
});
