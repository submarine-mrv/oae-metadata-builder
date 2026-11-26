import { Outlet, useMatch, useParams, useRouterState } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom, type WritableAtom } from "jotai";
import { useLayoutEffect } from "react";
import NotFoundPage, { type NotFoundEntity } from "@/pages/not-found/NotFoundPage";
import { switchProjectAtom } from "@/state/actions";
import {
  activeDatasetIdAtom,
  activeExperimentIdAtom,
  activeProjectIdAtom,
  datasetsAtom,
  experimentsAtom,
  workspaceAtom,
} from "@/state/atoms";
import { type Resolution, resolveDataset, resolveExperiment, resolveProject } from "./slugs";
import { useProjectTransition } from "./useProjectTransition";

/**
 * Whether a navigation is taking the router off this route. Until it commits, the route stays
 * rendered with its old params, and must not select its entity again or rewrite the URL.
 */
function useLeaving() {
  const own = useMatch({ strict: false, select: (match) => match.pathname });
  return useRouterState({
    select: ({ location: { pathname } }) => pathname !== own && !pathname.startsWith(`${own}/`),
  });
}

/**
 * Layout for `/projects/$projectId/*`: opens the project named in the URL, then renders the page
 * once it is active, so the page never shows the previously active project.
 */
export function ProjectRoute() {
  const slug = useParams({ strict: false }).projectId ?? "";
  const { projects } = useAtomValue(workspaceAtom);
  const activeId = useAtomValue(activeProjectIdAtom);
  const switchProject = useSetAtom(switchProjectAtom);
  const transition = useProjectTransition();
  const leaving = useLeaving();
  const resolution = resolveProject(slug, projects);
  const project = resolution.kind === "found" ? resolution.value : null;

  useLayoutEffect(() => {
    if (!leaving && project && project.id !== activeId) {
      transition(() => switchProject(project.id));
    }
  });

  if (resolution.kind === "not-found") return <NotFoundPage entity="Project" id={slug} />;
  if (project?.id !== activeId) return null;
  return <Outlet />;
}

type EntityRouteProps<T extends { id: string; name: string }> = {
  entity: Exclude<NotFoundEntity, "Project">;
  param: "experimentId" | "datasetId";
  items: T[];
  selection: WritableAtom<string | null, [string | null], void>;
  resolve: (slug: string, items: T[]) => Resolution<T>;
  children: React.ReactNode;
};

/** Selects the experiment or dataset named in the URL, then renders its page. */
function EntityRoute<T extends { id: string; name: string }>({
  entity,
  param,
  items,
  selection,
  resolve,
  children,
}: EntityRouteProps<T>) {
  const params = useParams({ strict: false });
  const slug = params[param] ?? "";
  const [selected, select] = useAtom(selection);
  const leaving = useLeaving();
  const resolution = resolve(slug, items);
  const found = resolution.kind === "found" ? resolution.value : null;

  useLayoutEffect(() => {
    if (!leaving && found && selected !== found.id) select(found.id);
  });

  if (resolution.kind === "not-found") {
    return <NotFoundPage entity={entity} id={slug} projectSlug={params.projectId} />;
  }
  if (found?.id !== selected) return null;
  return <>{children}</>;
}

export function ExperimentRoute({ children }: { children: React.ReactNode }) {
  return (
    <EntityRoute
      entity="Experiment"
      param="experimentId"
      items={useAtomValue(experimentsAtom)}
      selection={activeExperimentIdAtom}
      resolve={resolveExperiment}
    >
      {children}
    </EntityRoute>
  );
}

export function DatasetRoute({ children }: { children: React.ReactNode }) {
  return (
    <EntityRoute
      entity="Dataset"
      param="datasetId"
      items={useAtomValue(datasetsAtom)}
      selection={activeDatasetIdAtom}
      resolve={resolveDataset}
    >
      {children}
    </EntityRoute>
  );
}
