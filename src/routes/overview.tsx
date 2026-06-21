import { createFileRoute } from "@tanstack/react-router";
import OverviewPage from "@/pages/overview/OverviewPage";

export const Route = createFileRoute("/overview")({
  component: OverviewPage,
});
