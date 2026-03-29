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
import { useMediaQuery } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconInfoCircle,
  IconHelp,
  IconDownload,
  IconFileImport,
  IconFileCheck
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
    // Extract just the formData for experiments (they don't have linking config in import)
    const experimentFormData = selected.experiments;
    // Pass datasets with their linking configuration
    importSelectedData(selected.project, experimentFormData, selected.datasets);
    importPreview.closePreview();
    router.push("/overview");
  };

  const pathname = usePathname();
  const pathToTab: Record<string, string> = {
    "/overview": "overview",
    "/project": "project",
    "/experiment": "experiment",
    "/dataset": "dataset",
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
            gap: "1rem"
          }}
        >
          {/* Logo and title - left aligned, links to Overview */}
          <Link
            href="/overview"
            onClick={() => setActiveTab("overview")}
            style={{ textDecoration: "none" }}
          >
            <Group gap="sm">
              <Image src="/cts-logo.png" alt="Carbon to Sea" h={32} w="auto" />
              <Text fw={500} size="md" c="hadal.9" ff="var(--font-display)">
                OAE Metadata Builder
              </Text>
            </Group>
          </Link>

          {/* Navigation tabs - centered (desktop only) */}
          {!isMobile && (
            <SegmentedControl
              style={{
                backgroundColor: "var(--brand-sunlight)"
              }}
              value={currentTab}
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
          )}

          {/* Actions - right aligned */}
          <Group gap="xs" justify="flex-end">
            {/* Import/Export buttons visible on desktop only */}
            {!isMobile && (
              <>
                <Button
                  variant="light"
                  leftSection={<IconFileImport size={16} />}
                  onClick={handleImportClick}
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
                {/* Import/Export in menu on mobile */}
                {isMobile && (
                  <>
                    <Menu.Item
                      leftSection={<IconFileImport size={16} />}
                      onClick={handleImportClick}
                    >
                      Import
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconDownload size={16} />}
                      onClick={openModal}
                    >
                      Export
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                <Menu.Item
                  leftSection={<IconInfoCircle size={16} />}
                  onClick={() => router.push("/about")}
                >
                  About
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileCheck size={16} />}
                  onClick={() => router.push("/checker")}
                >
                  Compliance Checker
                </Menu.Item>
                {/*<Menu.Item*/}
                {/*  leftSection={<IconHelp size={16} />}*/}
                {/*  onClick={() => router.push("/how-to")}*/}
                {/*>*/}
                {/*  How-to Guide*/}
                {/*</Menu.Item>*/}
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
              marginTop: "0.5rem"
            }}
            value={currentTab}
            onChange={handleNavigation}
            data={[
              { value: "overview", label: "Overview" },
              { value: "project", label: "Project" },
              { value: "experiment", label: "Experiments" },
              { value: "dataset", label: "Datasets" }
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

      <ImportPreviewModal
        opened={importPreview.state.isOpen}
        onClose={importPreview.closePreview}
        filename={importPreview.state.filename}
        items={importPreview.state.items}
        onToggleItem={importPreview.toggleItem}
        onSetDatasetLinking={importPreview.setDatasetExperimentLinking}
        getExperimentLinkOptions={importPreview.getExperimentLinkOptions}
        duplicateExperimentIdError={importPreview.state.duplicateExperimentIdError}
        onImport={handleImport}
      />
    </>
  );
}
