import { useLocation } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { clearActiveProjectAtom } from "@/state/actions";

/** Reset on list entry, not page remount: selecting a project also remounts the outlet. */
export function useProjectListSelection() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const clear = useSetAtom(clearActiveProjectAtom);
  useEffect(() => {
    if (pathname === "/projects") clear();
  }, [pathname, clear]);
}
