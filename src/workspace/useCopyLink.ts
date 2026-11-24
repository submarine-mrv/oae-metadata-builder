import { useClipboard } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useRouter } from "@tanstack/react-router";
import { useStore } from "jotai";
import { useCallback } from "react";
import { workspaceAtom } from "@/state/atoms";
import { type EntityPage, entityLocation } from "./slugs";

/** Copies an absolute link using the same stable internal IDs as the address bar. */
export function useCopyLink() {
  const store = useStore();
  const router = useRouter();
  const clipboard = useClipboard();
  return useCallback(
    (page: EntityPage, projectId: string, entityId?: string) => {
      const location = entityLocation(store.get(workspaceAtom), projectId, page, entityId);
      if (!location) return;
      const { href } = router.buildLocation(location);
      clipboard.copy(new URL(href, window.location.origin).toString());
      notifications.show({ message: "Link copied", color: "teal", autoClose: 2000 });
    },
    [store, router, clipboard],
  );
}
