import { Container, Title, Text, Stack, Button } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import AppLayout from "./AppLayout";
import { useAppState } from "@/contexts/AppStateContext";

export default function EmptyEntityPage({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  const navigate = useNavigate();
  const { setActiveTab } = useAppState();

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
            onClick={() => {
              setActiveTab("overview");
              navigate({ to: "/overview" });
            }}
          >
            Back to Overview
          </Button>
        </Stack>
      </Container>
    </AppLayout>
  );
}
