import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { activeExperimentIdAtom, activeProjectAtom } from "@/state/atoms";

const UNIQUE_ID = "Choose a unique ID before publishing.";
const TAKEN = `This ID is already in use. ${UNIQUE_ID}`;

/** Availability is advisory: never change the draft or participate in cloud sync. */
export function useIdAvailability(
  kind: "project" | "experiment",
  value: unknown,
  focused: boolean,
  valid: boolean,
): { message: string | null; retry(): void } {
  const { user } = useAuth();
  const project = useAtomValue(activeProjectAtom);
  const experimentId = useAtomValue(activeExperimentIdAtom);
  const sourceId = project?.id;
  const userId = user?.id;
  const candidate = typeof value === "string" ? value : "";
  const normalized = candidate.toLowerCase();
  const localConflict = !normalized
    ? null
    : kind === "experiment" && project?.state.projectData.project_id?.toLowerCase() === normalized
      ? `The project has this ID. ${UNIQUE_ID}`
      : project?.state.experiments.some(
            (experiment) =>
              (kind === "project" || experiment.id !== experimentId) &&
              experiment.formData.experiment_id?.toLowerCase() === normalized,
          )
        ? `${kind === "experiment" ? "Another experiment" : "An experiment"} in this project has this ID. ${UNIQUE_ID}`
        : null;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([userId, sourceId, kind, experimentId, candidate, revision]);
  const [result, setResult] = useState<{ key: string; message: string | null } | null>(null);

  useEffect(() => {
    if (
      focused ||
      !valid ||
      !candidate ||
      !sourceId ||
      !userId ||
      !authEnabled ||
      authProvider !== "supabase" ||
      localConflict
    ) {
      return;
    }
    let cancelled = false;
    setResult(null);
    void import("./supabasePublicationClient")
      .then(({ createPublicationClient }) =>
        createPublicationClient(userId).checkIds(
          sourceId,
          kind === "project" ? candidate : "",
          kind === "experiment" ? [candidate] : [],
        ),
      )
      .then((conflicts) => {
        if (!cancelled) setResult({ key, message: conflicts.length ? TAKEN : null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            message: `${
              error instanceof Error ? error.message : "Could not check ID availability."
            } Availability will be checked again when publishing.`,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [candidate, focused, key, kind, localConflict, sourceId, userId, valid]);

  return {
    message:
      !focused && valid && candidate
        ? (localConflict ?? (result?.key === key ? result.message : null))
        : null,
    retry: () => setRevision((previous) => previous + 1),
  };
}
