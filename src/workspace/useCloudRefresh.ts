import { useLocation } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { activeProjectIdAtom } from "@/state/atoms";
import { projectSyncActionsAtom } from "./syncState";

/** Moving between pages of one project checks for changes at most this often. */
export const NAVIGATION_REFRESH_MS = 10_000;

/** Checks for changes made elsewhere on project switches, All projects, and page changes. */
export function useCloudRefresh() {
  const sync = useAtomValue(projectSyncActionsAtom);
  const projectId = useAtomValue(activeProjectIdAtom);
  const { pathname } = useLocation();
  useEffect(() => {
    if (projectId) void sync?.refresh();
  }, [sync, projectId]);
  useEffect(() => {
    void sync?.refresh(pathname === "/projects" ? 0 : NAVIGATION_REFRESH_MS);
  }, [sync, pathname]);
}
