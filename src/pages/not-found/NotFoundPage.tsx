import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconLogin } from "@tabler/icons-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { authEnabled } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";
import AppLayout from "@/components/AppLayout";

export type NotFoundEntity = "Project" | "Experiment" | "Dataset";

type NotFoundPageProps = {
  /** Omitted for a URL that matches no page. */
  entity?: NotFoundEntity;
  /** The ID from the URL, shown as typed. */
  id?: string;
  /** The project's slug, for a link back when an experiment or dataset is missing. */
  projectSlug?: string;
};

/**
 * Doesn't say whether a project exists but is private: inaccessible projects never load,
 * so they look the same as deleted ones.
 */
export default function NotFoundPage({ entity, id, projectSlug }: NotFoundPageProps) {
  const navigate = useNavigate();
  const href = useLocation({ select: (location) => location.href });
  const { user } = useAuth();

  const title = entity ? `${entity} not found` : "Page not found";
  const description = !entity
    ? "There is no page at this address."
    : entity === "Project"
      ? `Project ID "${id}" can't be found. It may have been renamed or deleted, or you may not have access to it.`
      : `${entity} ID "${id}" can't be found in this project. It may have been renamed or deleted.`;

  return (
    <AppLayout hideCopyLink>
      <Container size="md" py="xl">
        <Stack align="center" gap="md" py="xl">
          <Title order={2}>{title}</Title>
          <Text c="dimmed" ta="center">
            {description}
          </Text>
          <Group justify="center">
            {entity && entity !== "Project" && projectSlug && (
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={() =>
                  navigate({ to: "/projects/$projectId", params: { projectId: projectSlug } })
                }
              >
                Back to project
              </Button>
            )}
            {entity ? (
              <Button
                variant={entity === "Project" ? "filled" : "light"}
                onClick={() => navigate({ to: "/projects" })}
              >
                All projects
              </Button>
            ) : (
              <Button onClick={() => navigate({ to: "/overview" })}>Go to overview</Button>
            )}
            {entity === "Project" && authEnabled && !user && (
              <Button
                variant="light"
                leftSection={<IconLogin size={16} />}
                onClick={() =>
                  navigate({ to: "/auth/login", search: { error: undefined, returnTo: href } })
                }
              >
                Sign in
              </Button>
            )}
          </Group>
        </Stack>
      </Container>
    </AppLayout>
  );
}
