import { createFileRoute } from "@tanstack/react-router";
import HowToPage from "@/pages/how-to/HowToPage";

export const Route = createFileRoute("/how-to")({
  component: HowToPage,
});
