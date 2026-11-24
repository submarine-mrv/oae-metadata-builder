import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { activeExperimentIdAtom, activeProjectAtom } from "@/state/atoms";

const TAKEN =
  "This ID is already in use. Choose a unique ID before publishing. Your draft still saves.";
const LOCAL_DUPLICATE =
  "Another experiment in this project has this ID. Choose a unique ID before publishing. Your draft still saves.";

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
  const localDuplicate =
    kind === "experiment" &&
    !!candidate &&
    !!project?.state.experiments.some(
      (experiment) =>
        experiment.id !== experimentId &&
        experiment.formData.experiment_id?.toLowerCase() === candidate.toLowerCase(),
    );
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
      localDuplicate
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
  }, [candidate, focused, key, kind, localDuplicate, sourceId, userId, valid]);

  return {
    message:
      !focused && valid && candidate
        ? localDuplicate
          ? LOCAL_DUPLICATE
          : result?.key === key
            ? result.message
            : null
        : null,
    retry: () => setRevision((previous) => previous + 1),
  };
}
