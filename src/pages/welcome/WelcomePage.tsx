import { Anchor, Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import ImportFlow from "@/components/ImportFlow";
import { useImportFlow } from "@/hooks/useImportFlow";
import { useWorkspace } from "@/workspace/WorkspaceContext";

/** Shown at /overview while the workspace has no projects. */
export default function WelcomePage() {
  const { createProject } = useWorkspace();
  const navigate = useNavigate();
  const importFlow = useImportFlow();

  const handleCreate = () => {
    createProject();
    navigate({ to: "/project" });
  };

  return (
    <AppLayout>
      <Container size="sm" py="xl">
        <Stack gap="lg" py="xl">
          <Title order={1}>Welcome to the OAE Metadata Builder</Title>
          <Text>
            The metadata builder produces metadata for Ocean Alkalinity Enhancement (OAE) projects,
            experiments, and datasets in compliance with the{" "}
            <Anchor
              href="https://www.carbontosea.org/oae-data-protocol/1-0-0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OAE Data Management Protocol
            </Anchor>
            . The exported JSON files can be uploaded alongside datasets to any scientific data
            repository, or as part of a project submission to the{" "}
            <Anchor href="https://oaedata.org" target="_blank" rel="noopener noreferrer">
              OAE Data Commons
            </Anchor>
            .
          </Text>
          <Text>
            New here? Read the{" "}
            <Anchor component={Link} to="/how-to">
              how-to guide
            </Anchor>{" "}
            or the{" "}
            <Anchor component={Link} to="/about">
              About page
            </Anchor>
            .
          </Text>
          <Text size="sm" c="dimmed">
            Your work is saved in this browser only. Export a project to keep a copy.
          </Text>
          <Group mt="md">
            <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
              Create your first project
            </Button>
            <Button
              variant="default"
              leftSection={<IconFileImport size={16} />}
              onClick={importFlow.openFilePicker}
            >
              Import from file
            </Button>
          </Group>
        </Stack>
      </Container>
      <ImportFlow flow={importFlow} />
    </AppLayout>
  );
}
