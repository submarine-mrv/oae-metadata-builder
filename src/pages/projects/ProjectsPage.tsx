import { Button, Container, Group, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { type ProjectSummary, useWorkspace } from "@/workspace/WorkspaceContext";
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

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete project"
      >
        {pendingDelete && (
          <Stack>
            <Text size="sm">
              Delete <strong>{pendingDelete.name}</strong> and its {pendingDelete.experimentCount}{" "}
              experiment{pendingDelete.experimentCount === 1 ? "" : "s"} and{" "}
              {pendingDelete.datasetCount} dataset{pendingDelete.datasetCount === 1 ? "" : "s"}?
              This cannot be undone.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button color="red" onClick={confirmDelete}>
                Delete project
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </AppLayout>
  );
}
