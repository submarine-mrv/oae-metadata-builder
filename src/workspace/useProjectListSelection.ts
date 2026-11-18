import { useMatches } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { clearActiveProjectAtom } from "@/state/actions";

/**
 * Reset on list entry, not page remount: selecting a project also remounts the outlet. Reads the
 * rendered routes, not the location, which changes first: a project page still on screen would
 * open its project again.
 */
export function useProjectListSelection() {
  const onList = useMatches({
    select: (matches) => matches.some((m) => m.routeId === "/projects/"),
  });
  const clear = useSetAtom(clearActiveProjectAtom);
  useEffect(() => {
    if (onList) clear();
  }, [onList, clear]);
}
