import { Button, Container, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";

export default function EmptyEntityPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <Container size="md" py="xl">
        <Stack align="center" gap="md" py="xl">
          <Title order={2}>{title}</Title>
          <Text c="dimmed" ta="center">
            {description}
          </Text>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate({ to: "/overview" })}
          >
            Back to Overview
          </Button>
        </Stack>
      </Container>
    </AppLayout>
  );
}
