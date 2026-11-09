import { notifications } from "@mantine/notifications";
import { useStore } from "jotai";
import { workspaceAtom } from "@/state/atoms";
import { projectSyncActionsAtom, projectSyncErrorStatus, projectSyncStatusAtom } from "./syncState";
import { deleteProject } from "./workspace";

/**
 * Switching doesn't wait for saves: unsaved edits stay in memory and keep retrying, and the
 * sync icon shows failures. A delete waits for the server, or the project returns on reload.
 */
export function useProjectTransition() {
  const store = useStore();
  return (action: () => void, deleteId?: string): void => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync) {
      if (deleteId) store.set(workspaceAtom, (workspace) => deleteProject(workspace, deleteId));
      action();
      return;
    }
    if (!deleteId) {
      action();
      void sync.flush().catch(() => {});
      return;
    }
    void (async () => {
      try {
        await sync.remove(deleteId);
        action();
      } catch (error) {
        if (store.get(projectSyncActionsAtom) !== sync) return;
        store.set(projectSyncStatusAtom, projectSyncErrorStatus(error));
        notifications.show({
          title: "Could not delete project",
          message: error instanceof Error ? error.message : "Could not delete this project.",
          color: "red",
        });
      }
    })();
  };
}
