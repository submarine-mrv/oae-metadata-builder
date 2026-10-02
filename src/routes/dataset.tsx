import { createFileRoute } from "@tanstack/react-router";
import DatasetPage from "@/pages/dataset/DatasetPage";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/dataset")({
  component: () => (
    <RequireProject>
      <DatasetPage />
    </RequireProject>
  ),
});
