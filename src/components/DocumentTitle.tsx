import { useDocumentTitle } from "@mantine/hooks";
import { useAppState } from "@/contexts/AppStateContext";
import { documentTitle } from "@/workspace/types";

/** Keeps the browser tab title in step with the active project on every route. */
export default function DocumentTitle() {
  const { state } = useAppState();
  useDocumentTitle(documentTitle(state));
  return null;
}
