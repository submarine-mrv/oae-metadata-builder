import { createFileRoute } from "@tanstack/react-router";
import DatasetPage from "@/pages/dataset/DatasetPage";

export const Route = createFileRoute("/dataset")({
  component: DatasetPage,
});
