import { createFileRoute } from "@tanstack/react-router";
import ActivePageRedirect from "@/workspace/ActivePageRedirect";
import RequireProject from "@/workspace/RequireProject";

export const Route = createFileRoute("/project")({
  component: () => (
    <RequireProject>
      <ActivePageRedirect page="metadata" />
    </RequireProject>
  ),
});
