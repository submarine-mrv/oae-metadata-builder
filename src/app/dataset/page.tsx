"use client";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Box,
  Group
} from "@mantine/core";
import { IconX, IconDownload } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import uiSchema from "./uiSchema";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import Navigation from "@/components/Navigation";
import DownloadModal from "@/components/DownloadModal";
import FilenamesField from "@/components/FilenamesField";
import VariablesField from "@/components/VariablesField";
import { useAppState } from "@/contexts/AppStateContext";
import { getDatasetSchema } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { useDownloadModal } from "@/hooks/useDownloadModal";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

/**
 * Creates a modified dataset schema for RJSF form validation.
 *
 * ============================================================================
 * WORKAROUND: See beads issue oae-form-99i, GitHub #47
 * ============================================================================
 *
 * This modifies the schema to skip validation of variable array items.
 * Without this, RJSF validation fails for variables with type-specific fields
 * (e.g., pH calibration) because the base Variable schema has
 * `additionalProperties: false`.
 *
 * Variables are validated separately using their `_schemaKey` to select the
 * correct type-specific schema. See `src/utils/datasetValidation.ts`.
 *
 * REMOVE THIS when oae-form-c0s is complete (proper polymorphism via
 * LinkML type_designator and two-schema approach).
 */
function createFormSchema() {
  const schema = getDatasetSchema();

  // Replace variables schema to skip item validation
  // Variables are rendered by custom VariablesField and validated separately
  if (schema.properties?.variables) {
    const originalVars = schema.properties.variables;
    // Extract title/description if they exist (handle boolean schema case)
    const title = typeof originalVars === "object" ? originalVars.title : undefined;
    const description = typeof originalVars === "object" ? originalVars.description : undefined;

    schema.properties = {
      ...schema.properties,
      variables: {
        type: "array",
        title,
        description
      }
    };
  }

  return schema;
}

export default function DatasetPage() {
  const { state, updateDataset, getDataset, setActiveTab, setShowJsonPreview } =
    useAppState();

  // Use modified schema that skips variable item validation (workaround - see oae-form-99i)
  const [schema] = useState<any>(() => createFormSchema());
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

  /**
   * Controls whether RJSF shows the error list.
   * Set to true when user clicks "View Errors" in the download modal.
   *
   * Note: This is part of the validation workaround (oae-form-99i).
   * For dataset-level fields, RJSF handles validation and field highlighting.
   * For variables, we use custom validation (see datasetValidation.ts).
   */
  const [showErrorList, setShowErrorList] = useState(false);

  // Ref to the RJSF form for triggering validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);

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
    defaultSelection: "dataset"
  });

  /**
   * Handle "View Errors" click from download modal.
   * Closes modal, enables error display, and triggers RJSF validation.
   *
   * WORKAROUND: See oae-form-99i for why we have separate validation for variables.
   * RJSF validation works for dataset-level fields; variables are validated separately.
   */
  const handleViewErrors = useCallback(() => {
    // Close the modal first
    closeModal();

    // Enable error list display
    setShowErrorList(true);

    // Scroll to top where errors will appear
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Trigger RJSF validation by submitting the form
    // The form has no onSubmit handler, so it will just validate and show errors
    if (formRef.current) {
      formRef.current.submit();
    }
  }, [closeModal]);

  // Get current dataset
  const currentDataset = state.activeDatasetId
    ? getDataset(state.activeDatasetId)
    : null;

  // Memoize formData to prevent dependency changes on every render
  const formData = useMemo(
    () => currentDataset?.formData || {},
    [currentDataset?.formData]
  );

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
              ref={formRef}
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={handleFormChange}
              validator={validator}
              transformErrors={transformFormErrors}
              omitExtraData={false}
              liveOmit={false}
              experimental_defaultFormStateBehavior={{
                arrayMinItems: { populate: "all" },
                emptyObjectFields: "skipEmptyDefaults"
              }}
              fields={{
                FilenamesField: FilenamesField,
                VariablesField: VariablesField
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
                  SubmitButton: HiddenSubmitButton
                }
              }}
              showErrorList={showErrorList ? "top" : false}
            />

            {/* Download button - bypasses RJSF validation */}
            <Group justify="flex-end" mt="xl">
              <Button
                leftSection={<IconDownload size={18} />}
                onClick={openModal}
              >
                Download Dataset Metadata
              </Button>
            </Group>
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

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Download Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
        onViewErrors={handleViewErrors}
      />
    </div>
  );
}
