import { useDocumentTitle } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { documentTitleAtom } from "@/state/atoms";

/** Keeps the browser tab title in step with the active project on every route. */
export default function DocumentTitle() {
  useDocumentTitle(useAtomValue(documentTitleAtom));
  return null;
}
