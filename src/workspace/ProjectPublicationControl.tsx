import { Alert, Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import { activeProjectAtom } from "@/state/atoms";
import { buildProjectPublicationPayload } from "./publicationPayload";
import type {
  createPublicationClient,
  ProjectPublicationStatus,
} from "./supabasePublicationClient";
import { projectSyncActionsAtom } from "./syncState";
import { type ProjectRecord, projectDisplayName } from "./types";

type PublicationClient = ReturnType<typeof createPublicationClient>;

export default function ProjectPublicationControl() {
  const { user, isAuthenticated } = useAuth();
  const project = useAtomValue(activeProjectAtom);
  if (!authEnabled || authProvider !== "supabase" || !isAuthenticated || !user || !project) {
    return null;
  }
  return (
    <PublicationControl
      key={`${user.id}:${project.id}`}
      ownerId={user.id}
      sourceProjectId={project.id}
    />
  );
}

function PublicationControl({
  ownerId,
  sourceProjectId,
}: {
  ownerId: string;
  sourceProjectId: string;
}) {
  const store = useStore();
  const [client, setClient] = useState<PublicationClient | null>(null);
  const [status, setStatus] = useState<ProjectPublicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [review, setReview] = useState<ProjectRecord | null>(null);
  const [mode, setMode] = useState<"publish" | "unpublish">("publish");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const request = useRef(0);

  const loadStatus = useCallback(
    async (target: PublicationClient) => {
      const revision = ++request.current;
      setLoading(true);
      setStatusError(null);
      try {
        const next = await target.status(sourceProjectId);
        if (mounted.current && revision === request.current) setStatus(next);
      } catch (error) {
        if (mounted.current && revision === request.current) {
          setStatusError(error instanceof Error ? error.message : "Could not check publication.");
        }
      } finally {
        if (mounted.current && revision === request.current) setLoading(false);
      }
    },
    [sourceProjectId],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void import("./supabasePublicationClient")
      .then(({ createPublicationClient }) => {
        if (cancelled) return;
        const target = createPublicationClient(ownerId);
        setClient(target);
        void loadStatus(target);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatusError(error instanceof Error ? error.message : "Could not load publication.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      request.current++;
    };
  }, [ownerId, loadStatus]);

  const open = () => {
    setReview(store.get(activeProjectAtom));
    setMode("publish");
    setActionError(null);
    if (client) void loadStatus(client);
  };

  let validationError: string | null = null;
  if (review && mode === "publish") {
    try {
      buildProjectPublicationPayload(review);
    } catch (error) {
      validationError = error instanceof Error ? error.message : "Project validation failed.";
    }
  }

  const submit = async () => {
    if (!client || !review || loading || statusError || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (mode === "publish") {
        const sync = store.get(projectSyncActionsAtom);
        if (!sync)
          throw new Error("Cloud project storage is not ready. Retry after it has loaded.");
        await sync.flush();
        const current = store.get(activeProjectAtom);
        if (
          !mounted.current ||
          current?.id !== sourceProjectId ||
          JSON.stringify(current.state) !== JSON.stringify(review.state)
        ) {
          throw new Error("The project changed. Close this dialog and review the latest version.");
        }
        const next = await client.publish(sourceProjectId, buildProjectPublicationPayload(review));
        if (!mounted.current) return;
        setStatus(next);
      } else {
        await client.unpublish(sourceProjectId);
        if (!mounted.current) return;
        setStatus((previous) => (previous ? { ...previous, published: false } : null));
      }
      notifications.show({
        title: mode === "publish" ? "Project published" : "Project unpublished",
        message:
          mode === "publish"
            ? "The complete project is public in Data Commons after refresh. Later edits stay private until you publish again."
            : "The project is hidden from new Data Commons reads. Your private draft is unchanged.",
        color: "green",
      });
      setReview(null);
    } catch (error) {
      if (mounted.current) {
        setActionError(
          error instanceof Error ? error.message : "Publication failed. Please retry.",
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <>
      <Button variant="light" onClick={open}>
        Publication
      </Button>
      <Modal
        opened={review !== null}
        onClose={() => {
          if (!busy) setReview(null);
        }}
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
        withCloseButton={!busy}
        title="Project publication"
        centered
        size="lg"
      >
        {review && (
          <Stack>
            <Group justify="space-between">
              <Text fw={600}>{projectDisplayName(review.state)}</Text>
              <Badge color={status?.published ? "green" : "gray"}>
                {loading
                  ? "Checking status"
                  : statusError
                    ? "Status unavailable"
                    : status?.published
                      ? "Published"
                      : "Private"}
              </Badge>
            </Group>
            {status?.published && (
              <Text size="sm">
                Currently published as {status.projectId}. Draft edits do not change this
                publication until you publish again.
              </Text>
            )}
            {statusError && (
              <Alert color="red" title="Publication status unavailable">
                <Text size="sm">{statusError}</Text>
                <Button
                  mt="sm"
                  size="xs"
                  onClick={() => {
                    if (client) void loadStatus(client);
                  }}
                  disabled={!client || loading}
                >
                  Retry status
                </Button>
              </Alert>
            )}
            {mode === "publish" ? (
              <>
                <Text>
                  Publish the complete project, including {review.state.experiments.length}{" "}
                  experiments and {review.state.datasets.length} datasets, to Data Commons.
                </Text>
                <Alert color="yellow" title="This metadata will be public">
                  All metadata, including names, emails, identifiers and access links, will be
                  readable and downloadable without signing in. This replaces any previous
                  publication of this draft, including its previous project ID.
                </Alert>
                {validationError && (
                  <Alert color="red" title="Fix metadata before publishing">
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {validationError}
                    </Text>
                  </Alert>
                )}
              </>
            ) : (
              <Alert color="yellow" title="Unpublish this project?">
                This hides the entire project from new Data Commons reads. Your draft and saved
                metadata remain intact. Previously downloaded copies cannot be recalled.
              </Alert>
            )}
            {actionError && (
              <Alert color="red" title="Publication not completed">
                {actionError}
              </Alert>
            )}
            <Group justify="space-between">
              {mode === "publish" && status?.published ? (
                <Button
                  color="red"
                  variant="subtle"
                  disabled={busy || loading || !!statusError}
                  onClick={() => {
                    setMode("unpublish");
                    setActionError(null);
                  }}
                >
                  Unpublish...
                </Button>
              ) : (
                <Button variant="subtle" disabled={busy} onClick={() => setReview(null)}>
                  Cancel
                </Button>
              )}
              <Button
                color={mode === "unpublish" ? "red" : undefined}
                loading={busy}
                disabled={!client || loading || !!statusError || !!validationError}
                onClick={submit}
              >
                {mode === "unpublish"
                  ? "Confirm unpublish"
                  : status?.published
                    ? "Update publication"
                    : "Publish project"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
