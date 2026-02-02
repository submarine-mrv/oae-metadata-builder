"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Group
} from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
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
import AppLayout from "@/components/AppLayout";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
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
  const { state, updateDataset, getDataset, setActiveTab } =
    useAppState();

  // Use modified schema that skips variable item validation (workaround - see oae-form-99i)
  const [schema] = useState<any>(() => createFormSchema());

  /**
   * Controls whether RJSF shows the error list.
   * Set to true when user clicks "View Errors" in the download modal.
   *
   * Note: This is part of the validation workaround (oae-form-99i).
   * For dataset-level fields, RJSF handles validation and field highlighting.
   * For variables, we use custom validation (see datasetValidation.ts).
   */
  const [showErrorList, setShowErrorList] = useState(false);

  /**
   * Tracks whether validation should run after modal closes.
   * Set when user clicks "View Errors", cleared after validation runs.
   */
  const [pendingValidation, setPendingValidation] = useState(false);

  // Ref to the RJSF form for triggering validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);

  // Ref to the scrollable content container for scrolling to error list
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
   * Closes modal, enables error display, and sets pending validation flag.
   * Actual validation runs after modal exit transition completes.
   *
   * WORKAROUND: See oae-form-99i for why we have separate validation for variables.
   * RJSF validation works for dataset-level fields; variables are validated separately.
   */
  const handleViewErrors = () => {
    closeModal();
    setShowErrorList(true);
    setPendingValidation(true);
  };

  /**
   * Callback for when modal exit transition completes.
   * Triggers validation if pending (from View Errors click).
   * Using onExitTransitionEnd instead of setTimeout ensures validation
   * runs at exactly the right moment - after modal is fully closed.
   */
  const handleModalExitComplete = () => {
    if (!pendingValidation) return;
    setPendingValidation(false);

    // Query the form element directly from DOM (more reliable than RJSF ref)
    const formElement = document.querySelector('form') as HTMLFormElement | null;

    // reportValidity() shows browser validation bubbles and returns validity status
    const html5Valid = formElement?.reportValidity() ?? true;

    if (html5Valid && formRef.current) {
      // HTML5 validation passed - trigger RJSF/JSON schema validation
      formRef.current.submit();

      // Scroll to error list for JSON schema errors
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    // If HTML5 validation failed, reportValidity() already showed the bubble
    // and scrolled to the invalid field - no need to do anything else
  };

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

  const handleFormChange = (e: any) => {
    if (state.activeDatasetId) {
      updateDataset(state.activeDatasetId, e.formData);
    }
  };

  // Show message if no dataset is selected
  if (!currentDataset) {
    return (
      <AppLayout>
        <Container size="md" py="xl">
          <Stack align="center" gap="md">
            <Title order={2}>No Dataset Selected</Title>
            <Text c="dimmed">
              Please create or select a dataset from the Overview page.
            </Text>
          </Stack>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout noScroll>
      <div
        ref={scrollContainerRef}
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
            noHtml5Validate={false}
            experimental_defaultFormStateBehavior={{
              arrayMinItems: { populate: "never" },
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

      <JsonPreviewSidebar data={formData} />

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Download Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
        onViewErrors={handleViewErrors}
        onExitTransitionEnd={handleModalExitComplete}
      />
    </AppLayout>
  );
}
