import { createFileRoute } from "@tanstack/react-router";
import DatasetPage from "@/pages/dataset/DatasetPage";
import ActivePageRedirect from "@/workspace/ActivePageRedirect";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/dataset")({
  component: () => (
    <RequireProject>
      <ActivePageRedirect page="dataset">
        <DatasetPage />
      </ActivePageRedirect>
    </RequireProject>
  ),
});
