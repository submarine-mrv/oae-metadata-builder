"use client";
import React, { useRef } from "react";
import {
  Group,
  Button,
  Menu,
  Switch,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Text,
  Image,
  Box
} from "@mantine/core";
import {
  IconDotsVertical,
  IconInfoCircle,
  IconHelp,
  IconDownload,
  IconFileImport
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter } from "next/navigation";
import { importMetadata } from "@/utils/exportImport";
import DownloadModal from "@/components/DownloadModal";
import ImportPreviewModal from "@/components/ImportPreviewModal";
import { useDownloadModal } from "@/hooks/useDownloadModal";
import { useImportPreview } from "@/hooks/useImportPreview";

export default function Navigation() {
  const { state, setActiveTab, importSelectedData, toggleJsonPreview } =
    useAppState();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    showModal,
    sections,
    openModal,
    closeModal,
    handleDownload,
    handleSectionToggle
  } = useDownloadModal({
    projectData: state.projectData,
    experiments: state.experiments,
    datasets: state.datasets,
    defaultSelection: "all"
  });

  const importPreview = useImportPreview({
    currentProjectData: state.projectData,
    currentExperiments: state.experiments,
    currentDatasets: state.datasets
  });

  const handleNavigation = (value: string) => {
    const tab = value as "overview" | "project" | "experiment" | "dataset";
    setActiveTab(tab);
    const paths: Record<string, string> = {
      overview: "/overview",
      project: "/project",
      experiment: "/experiment",
      dataset: "/dataset"
    };
    router.push(paths[value]);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { projectData, experiments, datasets } = await importMetadata(file);

      // Extract form data from experiment/dataset states
      const experimentFormData = experiments.map((exp) => exp.formData);
      const datasetFormData = datasets.map((ds) => ds.formData);

      // Open preview modal instead of auto-importing
      importPreview.openPreview(file.name, projectData, experimentFormData, datasetFormData);

      // Reset file input
      e.target.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert(
        `Failed to import metadata: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleImport = () => {
    const selected = importPreview.getSelectedItems();
    importSelectedData(selected.project, selected.experiments, selected.datasets);
    importPreview.closePreview();
    router.push("/overview");
  };

  return (
    <>
      <Box
        px="lg"
        py="sm"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "1rem"
        }}
      >
        {/* Logo and title - left aligned */}
        <Group gap="sm">
          <Image src="/cts-logo.png" alt="Carbon to Sea" h={32} w="auto" />
          <Text fw={500} size="md" c="hadal.9" ff="var(--font-display)">
            OAE Metadata Builder
          </Text>
        </Group>

        {/* Navigation tabs - centered */}
        <SegmentedControl
          style={{
            backgroundColor: "var(--brand-sunlight)"
          }}
          value={state.activeTab}
          onChange={handleNavigation}
          data={[
            { value: "overview", label: "Overview" },
            { value: "project", label: "Project" },
            { value: "experiment", label: "Experiments" },
            { value: "dataset", label: "Datasets" }
          ]}
          size="md"
          radius="md"
        />

        {/* Actions - right aligned */}
        <Group gap="xs" justify="flex-end">
          <Tooltip label="Import metadata file">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleImportClick}
              aria-label="Import File"
            >
              <IconFileImport size={20} />
            </ActionIcon>
          </Tooltip>

          <Button
            variant="filled"
            leftSection={<IconDownload size={16} />}
            onClick={openModal}
          >
            Export
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="Menu">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconInfoCircle size={16} />}
                onClick={() => router.push("/about")}
              >
                About
              </Menu.Item>
              <Menu.Item
                leftSection={<IconHelp size={16} />}
                onClick={() => router.push("/how-to")}
              >
                How-to Guide
              </Menu.Item>
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
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Box>

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Export All Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
      />

      <ImportPreviewModal
        opened={importPreview.state.isOpen}
        onClose={importPreview.closePreview}
        filename={importPreview.state.filename}
        items={importPreview.state.items}
        onToggleItem={importPreview.toggleItem}
        onImport={handleImport}
      />
    </>
  );
}
