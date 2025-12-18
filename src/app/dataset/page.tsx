"use client";
import React, { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Box,
  Group,
  Paper,
  ActionIcon,
  Table
} from "@mantine/core";
import { IconX, IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps, SubmitButtonProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import uiSchema from "./uiSchema";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomSubmitButton from "@/components/rjsf/CustomSubmitButton";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import Navigation from "@/components/Navigation";
import DownloadConfirmationModal from "@/components/DownloadConfirmationModal";
import VariableModal from "@/components/VariableModal";
import FilenamesField from "@/components/FilenamesField";
import { useAppState } from "@/contexts/AppStateContext";
import { getDatasetSchema, getVariableTypeLabel } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { useMetadataDownload } from "@/hooks/useMetadataDownload";
import type { VariableFormData } from "@/types/forms";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Create a wrapper for the submit button with dataset-specific configuration
const DatasetSubmitButton = (props: SubmitButtonProps) => (
  <CustomSubmitButton {...props} buttonText="Download Dataset Metadata" />
);

export default function DatasetPage() {
  const {
    state,
    updateDataset,
    getDataset,
    setActiveTab,
    setShowJsonPreview
  } = useAppState();
  const [schema] = useState<any>(() => getDatasetSchema());
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [skipDownload, setSkipDownload] = useState(false);

  // Variable modal state
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editingVariableIndex, setEditingVariableIndex] = useState<number | null>(null);

  // Get current dataset
  const currentDataset = state.activeDatasetId
    ? getDataset(state.activeDatasetId)
    : null;

  const formData = currentDataset?.formData || {};
  const variables = (formData.variables as VariableFormData[]) || [];

  const {
    showDownloadModal,
    handleFormSubmit,
    handleDownloadConfirm,
    handleDownloadCancel
  } = useMetadataDownload({
    filename: "oae-dataset-metadata.json",
    skipDownload,
    onSkipDownloadChange: setSkipDownload
  });

  useEffect(() => {
    setActiveTab("dataset");
  }, [setActiveTab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        setSidebarWidth(Math.max(300, Math.min(800, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleFormChange = (e: any) => {
    if (state.activeDatasetId) {
      updateDataset(state.activeDatasetId, e.formData);
    }
  };

  const handleAddVariable = () => {
    setEditingVariableIndex(null);
    setVariableModalOpen(true);
  };

  const handleEditVariable = (index: number) => {
    setEditingVariableIndex(index);
    setVariableModalOpen(true);
  };

  const handleDeleteVariable = (index: number) => {
    if (state.activeDatasetId) {
      const newVariables = [...variables];
      newVariables.splice(index, 1);
      updateDataset(state.activeDatasetId, { variables: newVariables });
    }
  };

  const handleVariableSave = (variableData: VariableFormData) => {
    if (!state.activeDatasetId) return;

    const newVariables = [...variables];
    if (editingVariableIndex !== null) {
      // Update existing variable
      newVariables[editingVariableIndex] = variableData;
    } else {
      // Add new variable
      newVariables.push(variableData);
    }
    updateDataset(state.activeDatasetId, { variables: newVariables });
    setVariableModalOpen(false);
  };

  // Show message if no dataset is selected
  if (!currentDataset) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden"
        }}
      >
        <Navigation />
        <Container size="md" py="xl">
          <Stack align="center" gap="md">
            <Title order={2}>No Dataset Selected</Title>
            <Text c="dimmed">
              Please create or select a dataset from the Overview page.
            </Text>
          </Stack>
        </Container>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <Navigation />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            overflow: "auto"
          }}
        >
          <Container size="md" py="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={2}>Dataset Metadata: {currentDataset.name}</Title>
              </Group>
              <Text c="dimmed">
                Define metadata for your dataset including data files, platform
                information, and variable specifications.
              </Text>
            </Stack>

            <Form
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={handleFormChange}
              onSubmit={handleFormSubmit}
              validator={validator}
              transformErrors={transformFormErrors}
              omitExtraData={false}
              liveOmit={false}
              experimental_defaultFormStateBehavior={{
                arrayMinItems: { populate: "all" },
                emptyObjectFields: "skipEmptyDefaults"
              }}
              fields={{
                FilenamesField: FilenamesField
              }}
              widgets={{
                IsoIntervalWidget,
                CustomSelectWidget: CustomSelectWidget,
                TextWidget: BaseInputWidget,
                textarea: CustomTextareaWidget
              }}
              templates={{
                DescriptionFieldTemplate: NoDescription,
                ArrayFieldTemplate: CustomArrayFieldTemplate,
                ArrayFieldTitleTemplate: CustomArrayFieldTitleTemplate,
                ArrayFieldItemButtonsTemplate:
                  CustomArrayFieldItemButtonsTemplate,
                TitleFieldTemplate: CustomTitleFieldTemplate,
                ErrorListTemplate: CustomErrorList,
                ButtonTemplates: {
                  AddButton: CustomAddButton,
                  SubmitButton: DatasetSubmitButton
                }
              }}
              showErrorList="top"
            />

            {/* Variables Section */}
            <Paper withBorder p="md" mt="xl">
              <Group justify="space-between" mb="md">
                <Title order={4}>Variables</Title>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={handleAddVariable}
                  size="sm"
                >
                  Add Variable
                </Button>
              </Group>

              {variables.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  No variables added yet. Click &quot;Add Variable&quot; to define
                  the variables in your dataset.
                </Text>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Variable Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Unit</Table.Th>
                      <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {variables.map((variable, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          {variable.dataset_variable_name || "(unnamed)"}
                        </Table.Td>
                        <Table.Td>
                          {variable.variable_type
                            ? getVariableTypeLabel(variable.variable_type)
                            : "(no type)"}
                        </Table.Td>
                        <Table.Td>
                          {variable.variable_unit || "-"}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => handleEditVariable(index)}
                              title="Edit variable"
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteVariable(index)}
                              title="Delete variable"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Container>
        </div>

        {state.showJsonPreview && (
          <Box
            style={{
              width: sidebarWidth,
              minWidth: sidebarWidth,
              backgroundColor: "#f8f9fa",
              borderLeft: "1px solid #dee2e6",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}
          >
            {/* Resize handle */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "4px",
                height: "100%",
                backgroundColor: "transparent",
                cursor: "col-resize"
              }}
              onMouseDown={() => setIsResizing(true)}
            />

            {/* Header */}
            <Group
              justify="space-between"
              align="center"
              p="md"
              style={{ borderBottom: "1px solid #dee2e6" }}
            >
              <Text fw={600}>JSON Preview</Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setShowJsonPreview(false)}
              >
                <IconX size={16} />
              </Button>
            </Group>

            {/* Content */}
            <Box style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
              <pre
                style={{
                  fontSize: "0.8rem",
                  margin: 0,
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}
              >
                {JSON.stringify(formData, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
      </div>

      <DownloadConfirmationModal
        opened={showDownloadModal}
        onClose={handleDownloadCancel}
        onConfirm={handleDownloadConfirm}
        metadataType="dataset"
        title="Download Dataset Metadata"
      />

      <VariableModal
        opened={variableModalOpen}
        onClose={() => setVariableModalOpen(false)}
        onSave={handleVariableSave}
        initialData={editingVariableIndex !== null ? variables[editingVariableIndex] : undefined}
      />
    </div>
  );
}
