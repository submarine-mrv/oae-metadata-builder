import { Alert, Badge, Button, Group, List, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { activeProjectAtom } from "@/state/atoms";
import { buildProjectPublicationPayload } from "./publicationPayload";
import type { ProjectPublicationStatus } from "./supabasePublicationClient";
import { projectDisplayName } from "./types";

type Dialog = "publish" | "unpublish" | null;

export default function ProjectPublicationControl() {
  const { isAuthenticated } = useAuth();
  const project = useAtomValue(activeProjectAtom);
  const [publication, setPublication] = useState<ProjectPublicationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED === "true";
  const projectId = project?.state.projectData.project_id;

  useEffect(() => {
    if (!authEnabled || !isAuthenticated || !projectId) {
      setPublication(null);
      setStatusLoading(false);
      setStatusError(null);
      return;
    }

    let cancelled = false;
    setStatusLoading(true);
    setStatusError(null);
    setError(null);
    void import("./supabasePublicationClient")
      .then(({ loadProjectPublicationStatus }) => loadProjectPublicationStatus(projectId))
      .then((status) => {
        if (!cancelled) setPublication(status);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setStatusError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load this project's publication status.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, projectId]);

  const publicationError = useMemo(() => {
    if (!project) return "Select a project before publishing.";
    try {
      buildProjectPublicationPayload(project);
      return null;
    } catch (buildError) {
      return buildError instanceof Error
        ? buildError.message
        : "This project cannot be represented by the public metadata schema.";
    }
  }, [project]);

  if (!authEnabled || !isAuthenticated || !project) return null;

  const published = publication?.published === true;

  async function confirmPublish() {
    if (!project) return;
    setPending(true);
    setError(null);
    try {
      const { publishProject } = await import("./supabasePublicationClient");
      setPublication(await publishProject(project));
      setDialog(null);
      notifications.show({
        title: published ? "Publication updated" : "Project published",
        message: "The complete project is now available in OAE Data Commons.",
        color: "green",
      });
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : "Could not publish this project.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmUnpublish() {
    if (!projectId) return;
    setPending(true);
    setError(null);
    try {
      const { unpublishProject } = await import("./supabasePublicationClient");
      await unpublishProject(projectId);
      setPublication({ published: false, publishedAt: null });
      setDialog(null);
      notifications.show({
        title: "Project unpublished",
        message: "The project remains in your workspace but is no longer public.",
        color: "blue",
      });
    } catch (unpublishError) {
      setError(
        unpublishError instanceof Error
          ? unpublishError.message
          : "Could not unpublish this project.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Group gap="xs">
        {published && <Badge color="green">Published</Badge>}
        {statusError && (
          <>
            <Text size="xs" c="red" role="alert">
              {statusError}
            </Text>
            <Button
              type="button"
              variant="subtle"
              size="compact-xs"
              disabled={statusLoading}
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          </>
        )}
        {error && (
          <Text size="xs" c="red" role="alert">
            {error}
          </Text>
        )}
        {published && (
          <Button
            type="button"
            variant="default"
            size="compact-sm"
            disabled={statusLoading || statusError !== null}
            onClick={() => setDialog("unpublish")}
          >
            Unpublish
          </Button>
        )}
        <Button
          type="button"
          size="compact-sm"
          disabled={
            statusLoading || statusError !== null || (published && publicationError !== null)
          }
          onClick={() => {
            setError(null);
            setDialog("publish");
          }}
        >
          {statusLoading ? "Loading…" : published ? "Update publication" : "Publish"}
        </Button>
      </Group>

      <Modal
        opened={dialog === "publish"}
        onClose={() => setDialog(null)}
        title={published ? "Update project publication" : "Publish project"}
      >
        <Stack>
          <Text size="sm">
            Publishing makes this project and its complete experiment and dataset metadata available
            in the public OAE Data Commons catalog.
          </Text>
          <List size="sm">
            <List.Item>Project: {projectDisplayName(project.state)}</List.Item>
            <List.Item>Project ID: {projectId}</List.Item>
            <List.Item>
              {project.state.experiments.length} experiment
              {project.state.experiments.length === 1 ? "" : "s"}
            </List.Item>
            <List.Item>
              {project.state.datasets.length} dataset
              {project.state.datasets.length === 1 ? "" : "s"}
            </List.Item>
          </List>
          {publicationError && (
            <Alert color="red" title="Publication blocked">
              {publicationError}
            </Alert>
          )}
          {error && (
            <Alert color="red" title="Publication failed">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={publicationError !== null}
              onClick={confirmPublish}
            >
              {published ? "Update publication" : "Publish project"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={dialog === "unpublish"}
        onClose={() => setDialog(null)}
        title="Unpublish project"
      >
        <Stack>
          <Text size="sm">
            Hide <strong>{projectDisplayName(project.state)}</strong> and all its experiments and
            datasets from public catalog reads? The project and its draft will remain in your
            workspace.
          </Text>
          {error && (
            <Alert color="red" title="Unpublish failed">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" color="red" loading={pending} onClick={confirmUnpublish}>
              Unpublish project
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
