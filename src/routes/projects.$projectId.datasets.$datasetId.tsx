import { createFileRoute } from "@tanstack/react-router";
import DatasetPage from "@/pages/dataset/DatasetPage";
import { DatasetRoute } from "@/workspace/EntityRoutes";

export const Route = createFileRoute("/projects/$projectId/datasets/$datasetId")({
  component: () => (
    <DatasetRoute>
      <DatasetPage />
    </DatasetRoute>
  ),
});
