import { Button, Container, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import type { NotFoundEntity } from "./NotFoundPage";

export type AmbiguousMatch = {
  id: string;
  name: string;
  detail?: string;
};

type AmbiguousIdPageProps = {
  entity: NotFoundEntity;
  /** The ID from the URL, shown as typed. */
  id: string;
  matches: AmbiguousMatch[];
  onChoose: (id: string) => void;
};

/** Human IDs aren't unique in drafts, so a link may match several; the user picks rather than us guessing. */
export default function AmbiguousIdPage({ entity, id, matches, onChoose }: AmbiguousIdPageProps) {
  const navigate = useNavigate();
  const plural = entity === "Project" ? "projects" : `${entity.toLowerCase()}s`;

  return (
    <AppLayout hideCopyLink>
      <Container size="sm" py="xl">
        <Stack gap="md" py="xl">
          <Title order={2} ta="center">
            Multiple matches
          </Title>
          <Text c="dimmed" ta="center">
            {entity} ID "{id}" matches {matches.length} {plural}. Choose one:
          </Text>
          <Stack gap="xs">
            {matches.map((match) => (
              <UnstyledButton key={match.id} onClick={() => onChoose(match.id)}>
                <Paper withBorder p="sm" radius="md">
                  <Text fw={500}>{match.name}</Text>
                  {match.detail && (
                    <Text size="sm" c="dimmed">
                      {match.detail}
                    </Text>
                  )}
                </Paper>
              </UnstyledButton>
            ))}
          </Stack>
          <Button variant="light" onClick={() => navigate({ to: "/projects" })} mx="auto">
            All projects
          </Button>
        </Stack>
      </Container>
    </AppLayout>
  );
}
