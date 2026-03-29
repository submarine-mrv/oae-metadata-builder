import { createFileRoute } from "@tanstack/react-router";
import CheckerPage from "@/pages/checker/CheckerPage";

export const Route = createFileRoute("/checker")({
  component: CheckerPage,
});
