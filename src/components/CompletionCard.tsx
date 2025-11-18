import { Card, Stack, Group, Text, Badge, Progress, Button, Box } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";

interface CompletionCardProps {
  title: string;
  subtitle?: string;
  progress: number;
  onEdit: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  badge?: React.ReactNode;
  lastUpdated?: number;
  showDeleteButton?: boolean;
}

function getCompletionColor(percentage: number): string {
  if (percentage === 0) return "gray";
  if (percentage < 33) return "red";
  if (percentage < 66) return "orange";
  if (percentage < 100) return "yellow";
  return "green";
}

function getCompletionLabel(percentage: number): string {
  if (percentage === 0) return "Not Started";
  if (percentage < 33) return "Just Started";
  if (percentage < 66) return "In Progress";
  if (percentage < 100) return "Almost Done";
  return "Complete";
}

export function CompletionCard({
  title,
  subtitle,
  progress,
  onEdit,
  onDelete,
  badge,
  lastUpdated,
  showDeleteButton = false
}: CompletionCardProps) {
  const color = getCompletionColor(progress);
  const label = getCompletionLabel(progress);

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ cursor: "pointer" }}
      onClick={onEdit}
    >
      <Group justify="space-between" mb="md">
        <div>
          <Text fw={600} size="lg">
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
        {showDeleteButton && onDelete && (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            <IconTrash size={16} />
          </Button>
        )}
      </Group>

      {badge && <Box mb="md">{badge}</Box>}

      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm">Progress</Text>
          <Badge color={color}>{label}</Badge>
        </Group>
        <Progress value={progress} size="md" color={color} radius="md" />
        <Text size="xs" c="dimmed" ta="right">
          {progress}% complete
        </Text>
        {lastUpdated && (
          <Text size="xs" c="dimmed">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
