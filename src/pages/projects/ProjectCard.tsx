import { ActionIcon, Badge, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { formatRelativeTime } from "@/utils/relativeTime";
import type { ProjectSummary } from "@/workspace/WorkspaceContext";

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      onClick={onOpen}
      role="button"
      aria-label={`Open ${project.name}`}
      style={{
        cursor: "pointer",
        borderColor: project.isActive ? "var(--mantine-color-coral-4)" : undefined,
        borderWidth: project.isActive ? 2 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} truncate style={{ minWidth: 0 }}>
            {project.name}
          </Text>
          <Group gap={4} wrap="nowrap">
            {project.isActive && (
              <Badge size="xs" variant="light" color="coral">
                Active
              </Badge>
            )}
            <Tooltip label="Delete project">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${project.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        <Text size="xs" c="dimmed">
          {project.experimentCount} experiment{project.experimentCount === 1 ? "" : "s"} ·{" "}
          {project.datasetCount} dataset{project.datasetCount === 1 ? "" : "s"}
        </Text>
        <Text size="xs" c="dimmed">
          Edited {formatRelativeTime(project.updatedAt)}
        </Text>
      </Stack>
    </Card>
  );
}
