import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import type { AuthStore } from "@/auth/authStore";

export const Route = createRootRouteWithContext<{ auth: AuthStore }>()({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isRecoverySession && location.pathname !== "/auth/reset-password") {
      throw redirect({ to: "/auth/reset-password", search: { type: "recovery" } });
    }
  },
  component: () => <Outlet />,
});
