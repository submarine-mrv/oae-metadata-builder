import { Outlet, useMatch, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom, type WritableAtom } from "jotai";
import { useEffect, useLayoutEffect } from "react";
import AmbiguousIdPage from "@/pages/not-found/AmbiguousIdPage";
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
import { formatRelativeTime } from "@/utils/relativeTime";
import {
  datasetSlug,
  experimentSlug,
  projectSlug,
  type Resolution,
  resolveDataset,
  resolveExperiment,
  resolveProject,
} from "./slugs";
import { projectAccessAtom } from "./syncState";
import { projectDisplayName } from "./types";
import { useProjectTransition } from "./useProjectTransition";
import { useSlugResolution } from "./useSlugResolution";

type SlugParam = "projectId" | "experimentId" | "datasetId";

/** Replaces one slug in the current URL, keeping the rest of the path. */
function useReplaceParam(param: SlugParam) {
  const navigate = useNavigate();
  return (value: string, replace = true) =>
    navigate({
      to: ".",
      params: (prev: Record<string, string>) => ({ ...prev, [param]: value }),
      replace,
    });
}

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
  const access = useAtomValue(projectAccessAtom);
  const switchProject = useSetAtom(switchProjectAtom);
  const transition = useProjectTransition();
  const replaceSlug = useReplaceParam("projectId");
  const leaving = useLeaving();
  const { resolution, canonical } = useSlugResolution(slug, projects, resolveProject, projectSlug);
  const project = resolution.kind === "found" ? resolution.value : null;

  useLayoutEffect(() => {
    if (!leaving && project && project.id !== activeId) {
      transition(() => switchProject(project.id));
    }
  });

  useEffect(() => {
    if (!leaving && canonical && canonical !== slug) void replaceSlug(canonical);
  });

  if (resolution.kind === "not-found") return <NotFoundPage entity="Project" id={slug} />;
  if (resolution.kind === "ambiguous") {
    return (
      <AmbiguousIdPage
        entity="Project"
        id={slug}
        matches={resolution.matches.map((p) => {
          const owner = access[p.id]?.ownerEmail;
          const updated = `updated ${formatRelativeTime(p.updatedAt)}`;
          return {
            id: p.id,
            name: projectDisplayName(p.state),
            detail: owner ? `Owner ${owner} · ${updated}` : updated,
          };
        })}
        onChoose={(id) => void replaceSlug(id, false)}
      />
    );
  }
  if (project?.id !== activeId) return null;
  return <Outlet />;
}

type EntityRouteProps<T extends { id: string; name: string }> = {
  entity: Exclude<NotFoundEntity, "Project">;
  param: "experimentId" | "datasetId";
  items: T[];
  selection: WritableAtom<string | null, [string | null], void>;
  resolve: (slug: string, items: T[]) => Resolution<T>;
  canonicalSlug: (item: T, items: T[]) => string;
  children: React.ReactNode;
};

/** Selects the experiment or dataset named in the URL, then renders its page. */
function EntityRoute<T extends { id: string; name: string }>({
  entity,
  param,
  items,
  selection,
  resolve,
  canonicalSlug,
  children,
}: EntityRouteProps<T>) {
  const params = useParams({ strict: false });
  const slug = params[param] ?? "";
  const [selected, select] = useAtom(selection);
  const replaceSlug = useReplaceParam(param);
  const leaving = useLeaving();
  const { resolution, canonical } = useSlugResolution(slug, items, resolve, canonicalSlug);
  const found = resolution.kind === "found" ? resolution.value : null;

  useLayoutEffect(() => {
    if (!leaving && found && selected !== found.id) select(found.id);
  });

  useEffect(() => {
    if (!leaving && canonical && canonical !== slug) void replaceSlug(canonical);
  });

  if (resolution.kind === "not-found") {
    return <NotFoundPage entity={entity} id={slug} projectSlug={params.projectId} />;
  }
  if (resolution.kind === "ambiguous") {
    return (
      <AmbiguousIdPage
        entity={entity}
        id={slug}
        matches={resolution.matches.map((item) => ({
          id: item.id,
          name: item.name || `Unnamed ${entity.toLowerCase()}`,
          detail: `Internal ID ${item.id}`,
        }))}
        onChoose={(id) => void replaceSlug(id, false)}
      />
    );
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
      canonicalSlug={experimentSlug}
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
      canonicalSlug={datasetSlug}
    >
      {children}
    </EntityRoute>
  );
}
