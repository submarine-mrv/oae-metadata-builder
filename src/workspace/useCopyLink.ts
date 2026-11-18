import { useClipboard } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useRouter } from "@tanstack/react-router";
import { useStore } from "jotai";
import { useCallback } from "react";
import { workspaceAtom } from "@/state/atoms";
import { type EntityPage, entityLocation } from "./slugs";

/**
 * Copies an absolute link to a project page, using the same slugs as the address bar: human IDs
 * whenever set, even if shared. Such a link may match a different or several projects for someone
 * else, which the routes handle; see `EntityRoutes`.
 */
export function useCopyLink() {
  const store = useStore();
  const router = useRouter();
  const clipboard = useClipboard();
  return useCallback(
    (page: EntityPage, projectId: string, entityId?: string) => {
      const location = entityLocation(store.get(workspaceAtom), projectId, page, entityId, {
        share: true,
      });
      if (!location) return;
      const { href } = router.buildLocation(location);
      clipboard.copy(new URL(href, window.location.origin).toString());
      notifications.show({ message: "Link copied", color: "teal", autoClose: 2000 });
    },
    [store, router, clipboard],
  );
}
