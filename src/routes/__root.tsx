import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { AuthStore } from "@/auth/authStore";

export const Route = createRootRouteWithContext<{ auth: AuthStore }>()({
  component: () => <Outlet />,
});
