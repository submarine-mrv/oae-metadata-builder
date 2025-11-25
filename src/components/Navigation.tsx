"use client";
import React, { useRef } from "react";
import { Group, Button, Text, Menu } from "@mantine/core";
import {
  IconHome,
  IconFlask,
  IconFolder,
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
import { useTabNavigation } from "@/hooks/useTabNavigation";

export default function Navigation() {
  const { state, importAllData, setTriggerValidation } =
    useAppState();
  const router = useRouter();
  const { navigateToOverview, navigateToProject, navigateToExperiment } = useTabNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    // Validate all data before exporting
    const validation = validateAllData(state.projectData, state.experiments);

    if (!validation.isAllValid) {
      // Show alert with error summary
      const errorMessages: string[] = [];

      if (!validation.projectValidation.isValid) {
        errorMessages.push(
          `Project has ${validation.projectValidation.errorCount} error(s)`
        );
      }

      const invalidExperiments = Array.from(
        validation.experimentValidations.entries()
      ).filter(([, val]) => !val.isValid);

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
        navigateToProject();
        // Set trigger after navigation starts
        setTimeout(() => setTriggerValidation(true), 50);
      } else if (invalidExperiments.length > 0) {
        // Navigate to the first invalid experiment
        const [experimentId] = invalidExperiments[0];
        const experiment = state.experiments.find(
          (exp) => exp.id === experimentId
        );
        if (experiment) {
          navigateToExperiment(experimentId);
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
    <Group
      gap="md"
      p="md"
      justify="space-between"
      style={{
        borderBottom: "1px solid #dee2e6",
        backgroundColor: "#f8f9fa"
      }}
    >
      <Group gap="md">
        <Text size="lg" fw={700}>
          ODP Metadata Builder
        </Text>

        <Button
          variant={state.activeTab === "overview" ? "filled" : "subtle"}
          leftSection={<IconHome size={16} />}
          onClick={() => navigateToOverview()}
        >
          Home
        </Button>

        <Button
          variant={state.activeTab === "project" ? "filled" : "subtle"}
          leftSection={<IconFolder size={16} />}
          onClick={() => navigateToProject()}
        >
          Project
        </Button>

        <Button
          variant={state.activeTab === "experiment" ? "filled" : "subtle"}
          leftSection={<IconFlask size={16} />}
          onClick={() => navigateToExperiment()}
        >
          Experiments
        </Button>
      </Group>

      <Group gap="sm">
        <Button
          variant="light"
          leftSection={<IconFileImport size={16} />}
          onClick={handleImportClick}
        >
          Import File
        </Button>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
        >
          Export Metadata
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
            <Button variant="subtle">
              <IconMenu2 size={18} />
            </Button>
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
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
