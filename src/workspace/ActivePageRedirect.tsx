import { Navigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectIdAtom,
  workspaceAtom,
} from "@/state/atoms";
import { type EntityPage, entityLocation } from "./slugs";

/**
 * The pre-slug paths (`/overview`, `/project`, `/experiment`, `/dataset`) open the active project's
 * page at its slug URL. Without an experiment or dataset to open, `children` shows the empty state.
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
  const entityId = page === "experiment" ? experimentId : page === "dataset" ? datasetId : null;
  const location = projectId ? entityLocation(workspace, projectId, page, entityId) : null;
  return location ? <Navigate {...location} replace /> : children;
}
