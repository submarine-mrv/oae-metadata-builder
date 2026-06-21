import { createFileRoute } from "@tanstack/react-router";
import ExperimentPage from "@/pages/experiment/ExperimentPage";

export const Route = createFileRoute("/experiment")({
  component: ExperimentPage,
});
