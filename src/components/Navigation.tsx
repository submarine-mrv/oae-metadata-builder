import {
  ActionIcon,
  Box,
  Button,
  Group,
  Image,
  Menu,
  SegmentedControl,
  Switch,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconDownload,
  IconFileImport,
  IconHelp,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import DownloadModal from "@/components/DownloadModal";
import ImportFlow from "@/components/ImportFlow";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import { useAppState } from "@/contexts/AppStateContext";
import { useDownloadModal } from "@/hooks/useDownloadModal";
import { useImportFlow } from "@/hooks/useImportFlow";

export default function Navigation() {
  const { state, setActiveTab, toggleJsonPreview } = useAppState();
  const navigate = useNavigate();
  const importFlow = useImportFlow();

  const { showModal, sections, openModal, closeModal, handleDownload, handleSectionToggle } =
    useDownloadModal({
      projectData: state.projectData,
      experiments: state.experiments,
      datasets: state.datasets,
      defaultSelection: "all",
    });

  const handleNavigation = (value: string) => {
    const paths = {
      overview: "/overview",
      project: "/project",
      experiment: "/experiment",
      dataset: "/dataset",
      "how-to": "/how-to",
    } as const;
    if (value !== "how-to") {
      const tab = value as "overview" | "project" | "experiment" | "dataset";
      setActiveTab(tab);
    }
    navigate({ to: paths[value as keyof typeof paths] });
  };

  const pathname = useLocation({ select: (s) => s.pathname });
  const pathToTab: Record<string, string> = {
    "/overview": "overview",
    "/project": "project",
    "/experiment": "experiment",
    "/dataset": "dataset",
    "/how-to": "how-to",
  };
  const currentTab = pathToTab[pathname] ?? "";

  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <>
      <Box px="lg" py="sm">
        {/* Top row: logo + actions (+ menu on mobile) */}
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr auto" : "1fr auto 1fr",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Brand, then the active project as a breadcrumb */}
          <Group gap="sm" wrap="nowrap" pr="lg" style={{ minWidth: 0 }}>
            <Link
              to="/overview"
              onClick={() => setActiveTab("overview")}
              style={{ textDecoration: "none", flexShrink: 0 }}
            >
              <Group gap="sm" wrap="nowrap">
                <Image src="/cts-logo.png" alt="Carbon to Sea" h={32} w={36} decoding="sync" />
                <Text
                  fw={500}
                  size="md"
                  c="hadal.9"
                  ff="var(--font-display)"
                  style={{ whiteSpace: "nowrap" }}
                >
                  OAE Metadata Builder
                </Text>
              </Group>
            </Link>
            <ProjectSwitcher />
          </Group>

          {/* Navigation tabs - centered (desktop only) */}
          {!isMobile && (
            <SegmentedControl
              style={{
                backgroundColor: "var(--brand-sunlight)",
              }}
              value={currentTab}
              onChange={handleNavigation}
              data={[
                { value: "overview", label: "Overview" },
                { value: "project", label: "Project" },
                { value: "experiment", label: "Experiments" },
                { value: "dataset", label: "Datasets" },
              ]}
              size="md"
              radius="md"
            />
          )}

          {/* Actions - right aligned */}
          <Group gap="xs" justify="flex-end">
            {/* Import/Export buttons visible on desktop only */}
            {!isMobile && (
              <>
                <Button
                  variant="light"
                  leftSection={<IconFileImport size={16} />}
                  onClick={importFlow.openFilePicker}
                >
                  Import
                </Button>
                <Button
                  variant="outline"
                  leftSection={<IconDownload size={16} />}
                  onClick={openModal}
                >
                  Export
                </Button>
              </>
            )}

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" aria-label="Menu">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                {/* Import/Export in menu on mobile */}
                {isMobile && (
                  <>
                    <Menu.Item
                      leftSection={<IconFileImport size={16} />}
                      onClick={importFlow.openFilePicker}
                    >
                      Import
                    </Menu.Item>
                    <Menu.Item leftSection={<IconDownload size={16} />} onClick={openModal}>
                      Export
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                <Menu.Item
                  leftSection={<IconHelp size={16} />}
                  onClick={() => navigate({ to: "/how-to" })}
                >
                  How-to Guide
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconInfoCircle size={16} />}
                  onClick={() => navigate({ to: "/about" })}
                >
                  About
                </Menu.Item>
                {/* JSON Preview toggle — desktop only (sidebar is hidden on mobile) */}
                {!isMobile && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      closeMenuOnClick={false}
                      onClick={(e) => {
                        e.preventDefault();
                        toggleJsonPreview();
                      }}
                    >
                      <Switch
                        label="JSON Preview"
                        checked={state.showJsonPreview}
                        onChange={toggleJsonPreview}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>

        {/* Bottom row: SegmentedControl full-width (mobile only) */}
        {isMobile && (
          <SegmentedControl
            style={{
              backgroundColor: "var(--brand-sunlight)",
              marginTop: "0.5rem",
            }}
            value={currentTab}
            onChange={handleNavigation}
            data={[
              { value: "overview", label: "Overview" },
              { value: "project", label: "Project" },
              { value: "experiment", label: "Experiments" },
              { value: "dataset", label: "Datasets" },
            ]}
            size="xs"
            radius="md"
            fullWidth
          />
        )}
      </Box>

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Export All Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
      />

      <ImportFlow flow={importFlow} />
    </>
  );
}
