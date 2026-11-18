import { Alert, Button, Container, Group, SimpleGrid, Stack, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { authEnabled, authProvider } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import AppLayout from "@/components/AppLayout";
import { createProjectAtom, switchProjectAtom } from "@/state/actions";
import { type ProjectSummary, projectSummariesAtom } from "@/state/atoms";
import { useEntityNavigate } from "@/workspace/useEntityNavigate";
import { useProjectTransition } from "@/workspace/useProjectTransition";
import DeleteProjectModal from "./DeleteProjectModal";
import ProjectCard from "./ProjectCard";

export default function ProjectsPage() {
  const projects = useAtomValue(projectSummariesAtom);
  const switchProject = useSetAtom(switchProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const goTo = useEntityNavigate();
  const transition = useProjectTransition();
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated ? user?.id : undefined;
  const [publications, setPublications] = useState<{
    userId: string;
    ids: string[];
    error: string | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const cloudEnabled = authEnabled && authProvider === "supabase";

  useEffect(() => {
    if (!cloudEnabled || !userId || projects.length === 0) return;
    let cancelled = false;
    setPublications(null);
    void import("@/workspace/supabasePublicationClient")
      .then(({ createPublicationClient }) =>
        createPublicationClient(userId).publishedProjectIds(projects.map((project) => project.id)),
      )
      .then((ids) => {
        if (!cancelled) setPublications({ userId, ids, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPublications({
            userId,
            ids: [],
            error: error instanceof Error ? error.message : "Could not check project publications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cloudEnabled, userId, projects, retry]);

  const currentPublications = cloudEnabled && publications?.userId === userId ? publications : null;

  const openProject = (id: string) => {
    transition(() => {
      switchProject(id);
      goTo("overview", { projectId: id });
    });
  };

  const newProject = () => {
    transition(() => {
      createProject();
      goTo("metadata");
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    transition(() => {
      setPendingDelete(null);
    }, pendingDelete.id);
  };

  return (
    <AppLayout>
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={1}>Projects</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={newProject}>
              New project
            </Button>
          </Group>
          {currentPublications?.error && (
            <Alert color="red" title="Publication status unavailable">
              {currentPublications.error}
              <Button variant="subtle" size="xs" onClick={() => setRetry((value) => value + 1)}>
                Retry status
              </Button>
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                published={currentPublications?.ids.includes(project.id) ?? false}
                publicationUnknown={
                  !!userId && cloudEnabled && (!currentPublications || !!currentPublications.error)
                }
                onOpen={() => openProject(project.id)}
                onDelete={() => setPendingDelete(project)}
              />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>

      <DeleteProjectModal
        project={pendingDelete}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AppLayout>
  );
}
