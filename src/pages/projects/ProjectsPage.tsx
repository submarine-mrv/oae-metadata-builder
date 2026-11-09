import { Button, Container, Group, SimpleGrid, Stack, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { createProjectAtom, switchProjectAtom } from "@/state/actions";
import { type ProjectSummary, projectSummariesAtom } from "@/state/atoms";
import { useProjectTransition } from "@/workspace/useProjectTransition";
import DeleteProjectModal from "./DeleteProjectModal";
import ProjectCard from "./ProjectCard";

export default function ProjectsPage() {
  const projects = useAtomValue(projectSummariesAtom);
  const switchProject = useSetAtom(switchProjectAtom);
  const createProject = useSetAtom(createProjectAtom);
  const navigate = useNavigate();
  const transition = useProjectTransition();
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);

  const openProject = (id: string) => {
    transition(() => {
      switchProject(id);
      navigate({ to: "/overview" });
    });
  };

  const newProject = () => {
    transition(() => {
      createProject();
      navigate({ to: "/project" });
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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
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
