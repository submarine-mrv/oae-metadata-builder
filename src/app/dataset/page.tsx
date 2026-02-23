"use client";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import type { DescriptionFieldProps, RJSFValidationError } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import DateTimeWidget from "@/components/rjsf/DateTimeWidget";
import fieldDatasetUiSchema from "./uiSchema";
import modelSimulationUiSchema from "./modelSimulationUiSchema";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import LinkedExperimentIdWidget from "@/components/rjsf/LinkedExperimentIdWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import AppLayout from "@/components/AppLayout";
import EmptyEntityPage from "@/components/EmptyEntityPage";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import SingleItemDownloadModal from "@/components/SingleItemDownloadModal";
import FilenamesField from "@/components/FilenamesField";
import VariablesField from "@/components/VariablesField";
import { useAppState } from "@/contexts/AppStateContext";
import {
  getFieldDatasetSchema,
  getModelSimulationDatasetSchema
} from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { validateDataset } from "@/utils/validation";
import { exportSingleDataset } from "@/utils/exportImport";
import { useSingleItemDownload } from "@/hooks/useSingleItemDownload";
import { cleanDatasetFormDataForType } from "@/utils/datasetFields";
import {
  cleanupConditionalFields,
  type ConditionalFieldPair
} from "@/utils/conditionalFields";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

// Conditional field pairs for model simulation dataset forms
const DATASET_CONDITIONAL_FIELDS: ConditionalFieldPair[] = [
  {
    triggerField: "simulation_type",
    triggerValue: "perturbation",
    customField: "alkalinity_perturbation_description"
  }
];

/**
 * Creates a modified FieldDataset schema for RJSF form validation.
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
function createFieldDatasetFormSchema() {
  const schema = getFieldDatasetSchema();

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

function isModelOutputType(datasetType: string | undefined): boolean {
  return datasetType === "model_output";
}

export default function DatasetPage() {
  const { state, updateDataset, getDataset, setActiveTab } =
    useAppState();

  // Dynamic schema/uiSchema switching based on dataset_type
  const [activeSchema, setActiveSchema] = useState<any>(() => createFieldDatasetFormSchema());
  const [activeUiSchema, setActiveUiSchema] = useState<any>(fieldDatasetUiSchema);

  // Get current dataset
  const currentDataset = state.activeDatasetId
    ? getDataset(state.activeDatasetId)
    : null;

  // Memoize formData to prevent dependency changes on every render
  const formData = useMemo(
    () => currentDataset?.formData || {},
    [currentDataset?.formData]
  );

  // Use the download hook
  const hasExperiments = state.experiments.length > 0;
  const download = useSingleItemDownload({
    validate: () => validateDataset(formData, { hasExperiments }),
    export: () => exportSingleDataset(state.projectData, formData)
  });

  // Ref for formData so transformErrors can access latest data without
  // being recreated on every keystroke
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Dynamic schema switching based on dataset_type
  useEffect(() => {
    const datasetType = formData.dataset_type;

    if (isModelOutputType(datasetType)) {
      setActiveSchema(getModelSimulationDatasetSchema());
      setActiveUiSchema(modelSimulationUiSchema);
    } else {
      setActiveSchema(createFieldDatasetFormSchema());
      setActiveUiSchema(fieldDatasetUiSchema);
    }
  }, [formData.dataset_type]);

  // Wrap error transformer to:
  // 1. Suppress experiment_id errors when no experiments exist
  // 2. Inject variable validation errors (RJSF skips variable items
  //    validation due to polymorphism workaround — see oae-form-99i)
  const customTransformErrors = useMemo(() => {
    return (errors: RJSFValidationError[]) => {
      let transformed = transformFormErrors(errors);
      if (!hasExperiments) {
        transformed = transformed.filter(
          (e) =>
            !(
              e.name === "required" &&
              (e.params?.missingProperty === "experiment_id" ||
                e.property === ".experiment_id")
            )
        );
      }

      // Run variable validation and inject errors into RJSF's error list.
      // This is needed because RJSF uses a simplified schema that skips
      // variable item validation (polymorphism workaround - oae-form-99i).
      // Only applies to FieldDataset (ModelSimulationDataset has no variables field).
      if (!isModelOutputType(formDataRef.current.dataset_type)) {
        const datasetResult = validateDataset(formDataRef.current, { hasExperiments });
        const variableErrors = datasetResult.errors.filter(
          (e) => e.name === "variable"
        );
        if (variableErrors.length > 0) {
          transformed = [...transformed, ...variableErrors];
        }
      }

      return transformed;
    };
  }, [hasExperiments]);

  useEffect(() => {
    setActiveTab("dataset");
  }, [setActiveTab]);

  const handleFormChange = useCallback((e: any) => {
    if (!state.activeDatasetId) return;

    let newData = e.formData;

    // Check if dataset_type changed
    const oldType = formData.dataset_type;
    const newType = newData.dataset_type;

    if (oldType && newType && oldType !== newType) {
      // Dataset type changed — clean fields that don't belong to new type
      newData = cleanDatasetFormDataForType(newData, newType);
    }

    // Clean up conditional custom fields for model simulation datasets
    if (isModelOutputType(newData.dataset_type)) {
      newData = cleanupConditionalFields(newData, DATASET_CONDITIONAL_FIELDS);
    }

    updateDataset(state.activeDatasetId, newData);
  }, [formData, state.activeDatasetId, updateDataset]);

  // Show message if no dataset is selected
  if (!currentDataset) {
    return (
      <EmptyEntityPage
        title="No Dataset Selected"
        description="Please create or select a dataset from the Overview page."
      />
    );
  }

  return (
    <AppLayout noScroll>
      <div
        ref={download.scrollContainerRef}
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
            ref={download.formRef}
            schema={activeSchema}
            uiSchema={activeUiSchema}
            formData={formData}
            onChange={handleFormChange}
            validator={validator}
            transformErrors={customTransformErrors}
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
              textarea: CustomTextareaWidget,
              LinkedExperimentIdWidget: LinkedExperimentIdWidget,
              DateTimeWidget: DateTimeWidget
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
            showErrorList={download.showErrorList ? "top" : false}
          />

          {/* Download button - bypasses RJSF validation */}
          <Group justify="flex-end" mt="xl">
            <Button
              leftSection={<IconDownload size={18} />}
              onClick={download.handleDownloadClick}
            >
              Download Dataset Metadata
            </Button>
          </Group>
        </Container>
      </div>

      <JsonPreviewSidebar data={formData} />

      <SingleItemDownloadModal
        opened={download.showModal}
        onClose={download.closeModal}
        onDownload={download.handleDownload}
        title="Download Dataset Metadata"
        errorCount={download.errorCount}
        onGoBack={download.handleGoBack}
        onExitTransitionEnd={download.handleModalExitComplete}
      />
    </AppLayout>
  );
}
