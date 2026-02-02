"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Group
} from "@mantine/core";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps } from "@rjsf/utils";

import SpatialCoverageField from "@/components/SpatialCoverageField";
import DosingLocationField from "@/components/DosingLocationField";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import DateTimeWidget from "@/components/rjsf/DateTimeWidget";
import PlaceholderWidget from "@/components/rjsf/PlaceholderWidget";
import PlaceholderField from "@/components/rjsf/PlaceholderField";
import DosingConcentrationField from "@/components/rjsf/DosingConcentrationField";
import DosingDepthWidget from "@/components/rjsf/DosingDepthWidget";
import AppLayout from "@/components/AppLayout";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import SingleItemDownloadModal from "@/components/SingleItemDownloadModal";
import { useAppState } from "@/contexts/AppStateContext";
import { validateExperiment } from "@/utils/validation";
import { exportSingleExperiment } from "@/utils/exportImport";
import { useSingleItemDownload } from "@/hooks/useSingleItemDownload";
import experimentUiSchema from "./experimentUiSchema";
import interventionUiSchema from "./interventionUiSchema";
import tracerUiSchema from "./tracerUiSchema";
import { cleanFormDataForType } from "@/utils/experimentFields";
import {
  cleanupConditionalFields,
  type ConditionalFieldPair
} from "@/utils/conditionalFields";
import {
  getExperimentSchema,
  getInterventionSchema,
  getTracerSchema,
  getInterventionWithTracerSchema
} from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

// Conditional field pairs for experiment forms
// These define which custom fields should be cleaned up when their trigger conditions are not met
const EXPERIMENT_CONDITIONAL_FIELDS: ConditionalFieldPair[] = [
  {
    triggerField: "alkalinity_feedstock",
    triggerValue: "other",
    customField: "alkalinity_feedstock_custom"
  },
  {
    triggerField: "alkalinity_feedstock_processing",
    triggerValue: "other",
    customField: "alkalinity_feedstock_processing_custom"
  }
];

export default function ExperimentPage() {
  const router = useRouter();
  const { state, updateExperiment, setActiveTab } =
    useAppState();

  const [activeSchema, setActiveSchema] = useState<any>(() => getExperimentSchema());
  const [activeUiSchema, setActiveUiSchema] = useState<any>(experimentUiSchema);
  const [formData, setFormData] = useState<any>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const activeExperimentId = state.activeExperimentId;

  // Use the download hook - note: formData is used in callbacks
  // so we use arrow functions to capture current formData
  const download = useSingleItemDownload({
    validate: () => validateExperiment(formData),
    export: () => exportSingleExperiment(state.projectData, formData)
  });

  const experiment = activeExperimentId
    ? state.experiments.find((exp) => exp.id === activeExperimentId)
    : null;

  useEffect(() => {
    setActiveTab("experiment");
  }, [setActiveTab]);

  // Load experiment data when experiment ID changes
  useEffect(() => {
    // Reset initial load flag when switching experiments
    setIsInitialLoad(true);

    if (experiment) {
      setFormData({
        ...experiment.formData,
        project_id: state.projectData.project_id || ""
      });
      // Mark that initial data has been loaded (after a tick to let form mount)
      setTimeout(() => setIsInitialLoad(false), 0);
    }
  }, [activeExperimentId, state.projectData.project_id]); // Use ID instead of object to avoid infinite loop

  // Dynamic schema and uiSchema switching based on experiment_type
  useEffect(() => {
    const experimentType = formData.experiment_type;

    if (experimentType === "intervention") {
      setActiveSchema(getInterventionSchema());
      setActiveUiSchema(interventionUiSchema);
    } else if (experimentType === "tracer_study") {
      setActiveSchema(getTracerSchema());
      setActiveUiSchema(tracerUiSchema);
    } else if (experimentType === "intervention_with_tracer") {
      setActiveSchema(getInterventionWithTracerSchema());
      setActiveUiSchema(tracerUiSchema); // TODO: may need separate UI schema
    } else {
      // Use base Experiment schema (default for baseline, control, model, other)
      setActiveSchema(getExperimentSchema());
      setActiveUiSchema(experimentUiSchema);
    }
  }, [formData.experiment_type]);

  const handleFormChange = useCallback(
    (e: any) => {
      // Don't save to global state until initial data is loaded
      // This prevents RJSF's onChange on mount from overwriting real data with empty data
      if (isInitialLoad) {
        return;
      }

      let newData = e.formData;

      // Check if experiment_type changed
      const oldType = formData.experiment_type;
      const newType = newData.experiment_type;

      if (oldType && newType && oldType !== newType) {
        // Experiment type changed - clean fields that don't belong to new type
        newData = cleanFormDataForType(newData, newType);
      }

      // Clean up conditional custom fields when trigger conditions are not met
      // This prevents orphaned fields from rendering as "additional properties"
      newData = cleanupConditionalFields(newData, EXPERIMENT_CONDITIONAL_FIELDS);

      setFormData(newData);
      if (activeExperimentId) {
        updateExperiment(activeExperimentId, newData);
      }
    },
    [isInitialLoad, formData, activeExperimentId, updateExperiment]
  );

  const customValidate = (data: any, errors: any) => {
    // Validate vertical coverage depths
    const vc = data?.vertical_coverage;
    if (vc) {
      const minDepth = vc.min_depth_in_m;
      const maxDepth = vc.max_depth_in_m;

      if (typeof maxDepth === "number" && maxDepth > 0) {
        errors?.vertical_coverage?.max_depth_in_m?.addError(
          "Maximum depth must be 0 or negative (below sea surface)."
        );
      }

      if (
        typeof minDepth === "number" &&
        typeof maxDepth === "number" &&
        minDepth < maxDepth
      ) {
        errors?.vertical_coverage?.min_depth_in_m?.addError(
          "Minimum depth must be greater than or equal to maximum depth."
        );
      }
    }

    return errors;
  };

  if (!experiment) {
    return (
      <AppLayout>
        <Container size="md" py="lg">
          <Stack gap="md">
            <Title order={2}>No Experiment Selected</Title>
            <Text c="dimmed">
              Please go back to the overview and select an experiment to edit,
              or create a new one.
            </Text>
            <Button
              onClick={() => router.push("/overview")}
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to Overview
            </Button>
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
          <Stack gap="sm" mb="md">
            <Group align="center" gap="md">
              <Title order={2}>{experiment.name || "Experiment"}</Title>
            </Group>
            <Text c="dimmed">
              Edit experiment metadata. Fields marked with an asterisk (*) are
              required.
            </Text>
          </Stack>

          <Form
            ref={download.formRef}
            schema={activeSchema}
            uiSchema={activeUiSchema}
            formData={formData}
            onChange={handleFormChange}
            validator={validator}
            customValidate={customValidate}
            transformErrors={transformFormErrors}
            omitExtraData={false}
            liveOmit={false}
            experimental_defaultFormStateBehavior={{
              arrayMinItems: { populate: "never" },
              emptyObjectFields: "skipEmptyDefaults"
            }}
            widgets={{
              CustomSelectWidget: CustomSelectWidget,
              TextWidget: BaseInputWidget,
              textarea: CustomTextareaWidget,
              DateTimeWidget: DateTimeWidget,
              PlaceholderWidget: PlaceholderWidget,
              DosingDepthWidget: DosingDepthWidget
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
            fields={{
              SpatialCoverageMiniMap: SpatialCoverageField,
              PlaceholderField: PlaceholderField,
              DosingLocationField: DosingLocationField,
              DosingConcentrationField: DosingConcentrationField
            }}
            showErrorList={download.showErrorList ? "top" : false}
          />

          {/* Download button - bypasses RJSF validation */}
          <Group justify="flex-end" mt="xl">
            <Button
              leftSection={<IconDownload size={18} />}
              onClick={download.handleDownloadClick}
            >
              Download Experiment Metadata
            </Button>
          </Group>
        </Container>
      </div>

      <JsonPreviewSidebar data={formData} />

      <SingleItemDownloadModal
        opened={download.showModal}
        onClose={download.closeModal}
        onDownload={download.handleDownload}
        title="Download Experiment Metadata"
        errorCount={download.errorCount}
        onGoBack={download.handleGoBack}
        onExitTransitionEnd={download.handleModalExitComplete}
      />
    </AppLayout>
  );
}
