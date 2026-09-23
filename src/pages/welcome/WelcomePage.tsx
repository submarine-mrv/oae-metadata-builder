import { Anchor, Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import AppLayout from "@/components/AppLayout";
import ImportFlow from "@/components/ImportFlow";
import { useImportFlow } from "@/hooks/useImportFlow";
import { createProjectAtom } from "@/state/actions";

/** Shown at /overview while the workspace has no projects. */
export default function WelcomePage() {
  const createProject = useSetAtom(createProjectAtom);
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
            The metadata builder allows you to manage metadata for Ocean Alkalinity Enhancement
            (OAE) projects, experiments, and datasets in compliance with the{" "}
            <Anchor
              href="https://www.carbontosea.org/oae-data-protocol/1-0-0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OAE Data Management Protocol
            </Anchor>
            .
          </Text>
          <Text>
            If you have questions or concerns, please contact{" "}
            <Anchor href="mailto:data@carbontosea.org">data@carbontosea.org</Anchor>.
          </Text>
          <Text>
            For more information, visit the{" "}
            <Anchor component={Link} to="/about">
              About page
            </Anchor>
            .
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
