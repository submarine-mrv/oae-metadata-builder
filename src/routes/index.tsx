import { createFileRoute, redirect } from "@tanstack/react-router";

// The app has no dedicated landing page; "/" redirects to the overview.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/overview" });
  },
});
