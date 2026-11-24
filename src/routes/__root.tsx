import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Fragment } from "react";
import type { AuthStore } from "@/auth/authStore";
import { activeProjectIdAtom } from "@/state/atoms";
import { RemoteDeletionNotices } from "@/workspace/sync";
import { useCloudRefresh } from "@/workspace/useCloudRefresh";
import { useProjectListSelection } from "@/workspace/useProjectListSelection";

/** Remounts the routed page on project switch, so page-local UI state such as an open error list starts fresh. */
function ProjectScopedOutlet() {
  useProjectListSelection();
  useCloudRefresh();
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  return (
    <>
      <RemoteDeletionNotices />
      <Fragment key={activeProjectId ?? "empty"}>
        <Outlet />
      </Fragment>
    </>
  );
}

export const Route = createRootRouteWithContext<{ auth: AuthStore }>()({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isRecoverySession && location.pathname !== "/auth/reset-password") {
      throw redirect({ to: "/auth/reset-password", search: { type: "recovery" } });
    }
    // An invited account has no password of its own yet; nothing else opens until it sets one.
    if (
      context.auth.user?.needsPassword &&
      !context.auth.isRecoverySession &&
      location.pathname !== "/auth/set-password" &&
      location.pathname !== "/auth/callback"
    ) {
      throw redirect({
        to: "/auth/set-password",
        search: { returnTo: location.pathname.startsWith("/auth") ? undefined : location.href },
        replace: true,
      });
    }
  },
  component: ProjectScopedOutlet,
});
