import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { ProjectSummary } from "@/state/atoms";
import { formatRelativeTime } from "@/utils/relativeTime";
import classes from "./ProjectCard.module.css";

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
      style={{
        position: "relative",
        cursor: "pointer",
        borderColor: project.isActive ? "var(--mantine-color-coral-4)" : undefined,
        borderWidth: project.isActive ? 2 : 1,
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <UnstyledButton
            className={classes.open}
            onClick={onOpen}
            aria-label={`Open ${project.name}`}
          >
            <Text component="span" fw={600} truncate style={{ display: "block" }}>
              {project.name}
            </Text>
          </UnstyledButton>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
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
                style={{ position: "relative", zIndex: 1 }}
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
