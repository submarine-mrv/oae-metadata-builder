import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authEnabled } from "@/auth/config";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    if (!authEnabled) throw redirect({ to: "/overview" });
  },
  component: Outlet,
});
