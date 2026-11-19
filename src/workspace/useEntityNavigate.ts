import { useMatches, useNavigate } from "@tanstack/react-router";
import { useStore } from "jotai";
import { useCallback } from "react";
import { activeDatasetIdAtom, activeExperimentIdAtom, workspaceAtom } from "@/state/atoms";
import { type EntityPage, entityLocation } from "./slugs";

/** These read the active project and selection, and show the empty state when there is none. */
const ACTIVE_PATHS = {
  overview: "/overview",
  metadata: "/project",
  experiment: "/experiment",
  dataset: "/dataset",
} as const;

type Options = {
  /** Defaults to the active project. */
  projectId?: string;
  /** Experiment or dataset ID; defaults to the selected one. */
  entityId?: string;
  replace?: boolean;
};

/**
 * Navigates to a project page by its slug URL. Reads the store when called, so it can follow
 * an action in the same handler, such as creating an experiment and opening it.
 */
export function useEntityNavigate() {
  const store = useStore();
  const navigate = useNavigate();
  return useCallback(
    (page: EntityPage, { projectId, entityId, replace }: Options = {}) => {
      const workspace = store.get(workspaceAtom);
      const project = projectId ?? workspace.activeProjectId;
      const entity =
        entityId ??
        (page === "experiment"
          ? store.get(activeExperimentIdAtom)
          : page === "dataset"
            ? store.get(activeDatasetIdAtom)
            : null);
      const location = project ? entityLocation(workspace, project, page, entity) : null;
      return location
        ? navigate({ ...location, replace })
        : navigate({ to: ACTIVE_PATHS[page], replace });
    },
    [store, navigate],
  );
}

const PAGE_BY_ROUTE: Record<string, EntityPage> = {
  "/projects/$projectId/": "overview",
  "/projects/$projectId/metadata": "metadata",
  "/projects/$projectId/experiments/$experimentId": "experiment",
  "/projects/$projectId/datasets/$datasetId": "dataset",
};

/** The project page the URL is on, or null elsewhere. */
export function useCurrentEntityPage(): EntityPage | null {
  return useMatches({
    select: (matches) => {
      for (const match of matches) {
        const page = PAGE_BY_ROUTE[match.routeId];
        if (page) return page;
      }
      return null;
    },
  });
}
