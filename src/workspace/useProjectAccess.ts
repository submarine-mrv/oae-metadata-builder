import { useAtomValue } from "jotai";
import { activeProjectIdAtom } from "@/state/atoms";
import type { ProjectAccess } from "./projectCloudSync/types";
import { projectAccessAtom } from "./syncState";

/** The signed-in user's access to a project; undefined for guests and before it loads. */
export function useProjectAccess(projectId: string | null): ProjectAccess | undefined {
  const access = useAtomValue(projectAccessAtom);
  return projectId ? access[projectId] : undefined;
}

/** The active project's access. */
export function useActiveProjectAccess(): ProjectAccess | undefined {
  return useProjectAccess(useAtomValue(activeProjectIdAtom));
}

/** Guests, owners and editors can edit the active project; viewers can't. */
export function useCanEdit(): boolean {
  return useActiveProjectAccess()?.role !== "viewer";
}

/** Only the owner deletes a project, or manages who is on it. Guests own their projects. */
export function isProjectOwner(access: ProjectAccess | undefined): boolean {
  return (access?.role ?? "owner") === "owner";
}

/** Shared with others, from either side. */
export function isSharedProject(access: ProjectAccess | undefined): boolean {
  return access !== undefined && (access.role !== "owner" || access.memberCount > 0);
}
