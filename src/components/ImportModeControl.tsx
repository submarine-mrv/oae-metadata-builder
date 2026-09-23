import { Group, Radio, Stack, Text } from "@mantine/core";
import type { ImportMode } from "@/hooks/useImportFlow";

interface ImportModeControlProps {
  value: ImportMode;
  onChange: (mode: ImportMode) => void;
  currentProjectName: string;
}

/** Where an import goes: a new project, or merged into the open one. */
export default function ImportModeControl({
  value,
  onChange,
  currentProjectName,
}: ImportModeControlProps) {
  const card = (mode: ImportMode, title: string, description: string) => (
    <Radio.Card value={mode} radius="md" p="sm" style={{ flex: "1 1 240px" }}>
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Radio.Indicator mt={2} />
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>
            {title}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>
    </Radio.Card>
  );

  return (
    <Radio.Group value={value} onChange={(v) => onChange(v as ImportMode)} label="Import into">
      <Group gap="sm" mt={6} align="stretch">
        {card("new", "A new project", "Creates a separate project from this file.")}
        {card(
          "merge",
          currentProjectName,
          "Adds to the open project. Matching experiments and project metadata are replaced.",
        )}
      </Group>
    </Radio.Group>
  );
}
