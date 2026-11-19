import { useMatch, useRouter } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useEffect } from "react";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectIdAtom,
  workspaceAtom,
} from "@/state/atoms";
import { type EntityPage, entityLocation } from "./slugs";
import { projectSlugConflictsAtom } from "./syncState";

/**
 * The pre-slug paths (`/overview`, `/project`, `/experiment`, `/dataset`) open the active project's
 * page at its slug URL. Without an experiment or dataset to open, `children` shows the empty state.
 *
 * Pages on these paths can create a project and navigate on the same click (the welcome page),
 * which makes this redirect possible mid-navigation; it stands down once history has moved on.
 */
export default function ActivePageRedirect({
  page,
  children,
}: {
  page: EntityPage;
  children?: React.ReactNode;
}) {
  const workspace = useAtomValue(workspaceAtom);
  const projectId = useAtomValue(activeProjectIdAtom);
  const experimentId = useAtomValue(activeExperimentIdAtom);
  const datasetId = useAtomValue(activeDatasetIdAtom);
  const conflicts = useAtomValue(projectSlugConflictsAtom);
  const entityId = page === "experiment" ? experimentId : page === "dataset" ? datasetId : null;
  const location = projectId
    ? entityLocation(workspace, projectId, page, entityId, { conflicts })
    : null;
  const router = useRouter();
  // The rendered route's path: during a navigation `useLocation` already reports the next one.
  const pathname = useMatch({ strict: false, select: (m) => m.pathname });
  const href = location ? router.buildLocation(location).href : null;
  useEffect(() => {
    if (!href || router.history.location.pathname !== pathname) return;
    void router.navigate({ href, replace: true });
  }, [href, pathname, router]);
  return location ? null : children;
}
