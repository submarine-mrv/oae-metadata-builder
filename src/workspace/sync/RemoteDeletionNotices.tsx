import { notifications } from "@mantine/notifications";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAtomValue, useStore } from "jotai";
import { useEffect, useRef } from "react";
import { activeDatasetIdAtom, activeExperimentIdAtom, activeProjectIdAtom } from "@/state/atoms";
import { type RemoteDeletion, remoteDeletionsAtom } from "../syncState";

const label = ({ type, name }: RemoteDeletion) => `${type} "${name}"`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function remoteDeletionMessage(deletions: RemoteDeletion[]): string {
  const removed = `${capitalize(deletions.map(label).join(", "))} ${deletions.length === 1 ? "was" : "were"} deleted in another tab or on another device.`;
  const edited = deletions.filter((deletion) => deletion.unsavedEdits);
  if (!edited.length) return removed;
  const target = deletions.length === 1 ? "it" : edited.map(label).join(", ");
  return `${removed} Your recent edits to ${target} weren't saved.`;
}

/**
 * Tells the user about projects, experiments and datasets removed because they were deleted
 * elsewhere, and leaves the page of an experiment or dataset that was open when it went.
 */
export default function RemoteDeletionNotices() {
  const store = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const projectId = useAtomValue(activeProjectIdAtom);
  const experimentId = useAtomValue(activeExperimentIdAtom);
  const datasetId = useAtomValue(activeDatasetIdAtom);
  // What was on screen at the last render; the store has already moved on when a notice arrives.
  const shown = useRef({ pathname, projectId, experimentId, datasetId });
  useEffect(() => {
    shown.current = { pathname, projectId, experimentId, datasetId };
  });

  useEffect(() => {
    const show = () => {
      const pending = store.get(remoteDeletionsAtom);
      if (!pending.length) return;
      store.set(remoteDeletionsAtom, []);
      notifications.show({
        title: "Deleted",
        message: remoteDeletionMessage(pending),
        color: "yellow",
        autoClose: 8000,
      });
      const view = shown.current;
      const lostPage = pending.some(
        (deletion) =>
          deletion.projectId === view.projectId &&
          ((deletion.type === "experiment" &&
            view.pathname === "/experiment" &&
            deletion.id === view.experimentId) ||
            (deletion.type === "dataset" &&
              view.pathname === "/dataset" &&
              deletion.id === view.datasetId)),
      );
      if (lostPage) void navigate({ to: "/overview" });
    };
    show();
    return store.sub(remoteDeletionsAtom, show);
  }, [store, navigate]);
  return null;
}
