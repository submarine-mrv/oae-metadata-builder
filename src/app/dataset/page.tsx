"use client";
import React, { useEffect, useState, useMemo } from "react";
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
import LinkedExperimentIdWidget from "@/components/rjsf/LinkedExperimentIdWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import AppLayout from "@/components/AppLayout";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import SingleItemDownloadModal from "@/components/SingleItemDownloadModal";
import FilenamesField from "@/components/FilenamesField";
import VariablesField from "@/components/VariablesField";
import { useAppState } from "@/contexts/AppStateContext";
import { getDatasetSchema } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { validateDataset } from "@/utils/validation";
import { exportSingleDataset } from "@/utils/exportImport";
import { useSingleItemDownload } from "@/hooks/useSingleItemDownload";

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
              textarea: CustomTextareaWidget,
              LinkedExperimentIdWidget: LinkedExperimentIdWidget
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
