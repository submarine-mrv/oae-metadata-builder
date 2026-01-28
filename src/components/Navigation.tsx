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
  IconMenu2,
  IconInfoCircle,
  IconHelp,
  IconDownload,
  IconFileImport
} from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useRouter } from "next/navigation";
import { exportMetadata, importMetadata } from "@/utils/exportImport";
import { validateAllData } from "@/utils/validation";

export default function Navigation() {
  const {
    state,
    setActiveTab,
    setActiveExperiment,
    importAllData,
    setTriggerValidation,
    toggleJsonPreview
  } = useAppState();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNavigation = (value: string) => {
    const tab = value as "overview" | "project" | "experiment" | "dataset";
    setActiveTab(tab);
    const paths: Record<string, string> = {
      overview: "/",
      project: "/project",
      experiment: "/experiment",
      dataset: "/dataset"
    };
    router.push(paths[value]);
  };

  const handleExport = async () => {
    // Validate all data before exporting
    const validation = validateAllData(state.projectData, state.experiments);

    if (!validation.isAllValid) {
      // Count total errors
      let totalErrors = validation.projectValidation.errorCount;
      validation.experimentValidations.forEach((expVal) => {
        totalErrors += expVal.errorCount;
      });

      // Show alert with error summary
      const errorMessages: string[] = [];

      if (!validation.projectValidation.isValid) {
        errorMessages.push(
          `Project has ${validation.projectValidation.errorCount} error(s)`
        );
      }

      const invalidExperiments = Array.from(
        validation.experimentValidations.entries()
      ).filter(([_, val]) => !val.isValid);

      if (invalidExperiments.length > 0) {
        errorMessages.push(
          `${invalidExperiments.length} experiment(s) have validation errors`
        );
      }

      alert(
        `Cannot export metadata. Please fix the following errors:\n\n${errorMessages.join("\n")}\n\nCheck the browser console for detailed error information.`
      );

      // Navigate to the first page with errors
      if (!validation.projectValidation.isValid) {
        router.push("/project");
        // Set trigger after navigation starts
        setTimeout(() => setTriggerValidation(true), 50);
      } else if (invalidExperiments.length > 0) {
        // Navigate to the first invalid experiment
        const [experimentId] = invalidExperiments[0];
        const experiment = state.experiments.find(
          (exp) => exp.id === experimentId
        );
        if (experiment) {
          setActiveExperiment(experimentId);
          setActiveTab("experiment");
          router.push("/experiment");
          // Set trigger after navigation starts
          setTimeout(() => setTriggerValidation(true), 50);
        }
      }

      return;
    }

    // All data is valid, proceed with export
    exportMetadata(state.projectData, state.experiments);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { projectData, experiments } = await importMetadata(file);
      importAllData(projectData, experiments);
      // Reset file input
      e.target.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert(
        `Failed to import metadata: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
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
          onClick={handleExport}
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
              <IconMenu2 size={20} />
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
  );
}
