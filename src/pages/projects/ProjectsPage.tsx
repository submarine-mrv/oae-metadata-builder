import { Button, Card, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { type ProjectSummary, useWorkspace } from "@/workspace/WorkspaceContext";
import DeleteProjectModal from "./DeleteProjectModal";
import ProjectCard from "./ProjectCard";

export default function ProjectsPage() {
  const { projects, switchProject, createProject, deleteProject } = useWorkspace();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);

  const openProject = (id: string) => {
    switchProject(id);
    navigate({ to: "/overview" });
  };

  const newProject = () => {
    createProject();
    navigate({ to: "/project" });
  };

  const confirmDelete = () => {
    if (pendingDelete) deleteProject(pendingDelete.id);
    setPendingDelete(null);
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
          {projects.length === 0 ? (
            <Card
              withBorder
              padding="xl"
              radius="md"
              style={{ borderStyle: "dashed", borderWidth: 2, maxWidth: 420 }}
            >
              <Stack align="center" gap="sm">
                <Text fw={500}>No projects yet</Text>
                <Text size="sm" c="dimmed" ta="center">
                  A project holds its metadata, experiments and datasets.
                </Text>
                <Button leftSection={<IconPlus size={16} />} onClick={newProject}>
                  Create project
                </Button>
              </Stack>
            </Card>
          ) : (
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
          )}
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
