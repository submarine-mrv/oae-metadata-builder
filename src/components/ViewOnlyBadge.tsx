import { Badge } from "@mantine/core";
import { useCanEdit } from "@/workspace/useProjectAccess";

/** Marks pages of a project the user can view but not edit. */
export default function ViewOnlyBadge() {
  if (useCanEdit()) return null;
  return (
    <Badge variant="light" color="gray">
      View only
    </Badge>
  );
}
