import { Button, Group, Menu, Text } from "@mantine/core";
import { IconCheck, IconChevronDown, IconFolders, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "@/contexts/AppStateContext";
import { projectDisplayName } from "@/workspace/types";
import { useWorkspace } from "@/workspace/WorkspaceContext";

/**
 * The active project after the brand name, as a breadcrumb: "OAE Metadata Builder / Kiel trial ▾".
 * Rendered whenever a project exists; Navigation leaves it out of an empty workspace.
 */
export default function ProjectSwitcher() {
  const { projects, activeProjectId, createProject, switchProject } = useWorkspace();
  const { state } = useAppState();
  const navigate = useNavigate();

  // Live from the editing session, so the title follows the Research Project name as it's typed.
  const activeName = projectDisplayName(state);

  const handleNew = () => {
    createProject();
    navigate({ to: "/project" });
  };

  const handleSwitch = (id: string) => {
    if (id !== activeProjectId) switchProject(id);
    navigate({ to: "/overview" });
  };

  return (
    <Menu shadow="md" width={320} position="bottom-start">
      <Menu.Target>
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Text c="dimmed" size="md" aria-hidden style={{ flexShrink: 0 }}>
            /
          </Text>
          <Button
            variant="subtle"
            color="hadal"
            size="compact-md"
            px={6}
            rightSection={<IconChevronDown size={14} />}
            aria-label={`Current project: ${activeName}`}
          >
            {/* Ellipsis needs a block box; the button label itself is a flex row. */}
            <Text
              component="span"
              size="sm"
              fw={500}
              truncate
              style={{ display: "block", maxWidth: 200 }}
            >
              {activeName}
            </Text>
          </Button>
        </Group>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Projects</Menu.Label>
        {projects.map((project) => (
          <Menu.Item
            key={project.id}
            onClick={() => handleSwitch(project.id)}
            styles={{ itemLabel: { minWidth: 0 } }}
            leftSection={
              project.isActive ? (
                <IconCheck size={16} />
              ) : (
                <span style={{ display: "inline-block", width: 16 }} />
              )
            }
          >
            <Text size="sm" truncate>
              {project.id === activeProjectId ? activeName : project.name}
            </Text>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconPlus size={16} />} onClick={handleNew}>
          New project
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFolders size={16} />}
          onClick={() => navigate({ to: "/projects" })}
        >
          All projects…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
