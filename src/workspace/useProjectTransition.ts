import { notifications } from "@mantine/notifications";
import { useStore } from "jotai";
import { workspaceAtom } from "@/state/atoms";
import { projectSyncActionsAtom, projectSyncErrorStatus, projectSyncStatusAtom } from "./syncState";
import { deleteProject } from "./workspace";

/** Guest actions remain synchronous; authenticated transitions await durable saves. */
export function useProjectTransition() {
  const store = useStore();
  return (action: () => void, deleteId?: string): void => {
    const sync = store.get(projectSyncActionsAtom);
    if (!sync) {
      if (deleteId) store.set(workspaceAtom, (workspace) => deleteProject(workspace, deleteId));
      action();
      return;
    }
    void (async () => {
      try {
        if (deleteId) await sync.remove(deleteId);
        else await sync.flush();
        action();
      } catch (error) {
        if (store.get(projectSyncActionsAtom) !== sync) return;
        store.set(projectSyncStatusAtom, projectSyncErrorStatus(error));
        notifications.show({
          title: deleteId ? "Could not delete project" : "Project sync failed",
          message:
            error instanceof Error ? error.message : "Could not save before leaving this project.",
          color: "red",
        });
      }
    })();
  };
}
