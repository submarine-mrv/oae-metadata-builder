import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Fragment } from "react";
import type { AuthStore } from "@/auth/authStore";
import { activeProjectIdAtom } from "@/state/atoms";

/** Remounts the routed page on project switch, so page-local UI state such as an open error list starts fresh. */
function ProjectScopedOutlet() {
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  return (
    <Fragment key={activeProjectId ?? "empty"}>
      <Outlet />
    </Fragment>
  );
}

export const Route = createRootRouteWithContext<{ auth: AuthStore }>()({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isRecoverySession && location.pathname !== "/auth/reset-password") {
      throw redirect({ to: "/auth/reset-password", search: { type: "recovery" } });
    }
  },
  component: ProjectScopedOutlet,
});
