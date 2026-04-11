"use client";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Group
} from "@mantine/core";
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
import ResponsiveObjectFieldTemplate from "@/components/rjsf/ResponsiveObjectFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import CustomFieldTemplate from "@/components/rjsf/CustomFieldTemplate";
import DateTimeWidget from "@/components/rjsf/DateTimeWidget";
import PlaceholderWidget from "@/components/rjsf/PlaceholderWidget";
import PlaceholderField from "@/components/rjsf/PlaceholderField";
import DosingConcentrationField from "@/components/rjsf/DosingConcentrationField";
import DosingDepthWidget from "@/components/rjsf/DosingDepthWidget";
import LockableIdWidget from "@/components/rjsf/LockableIdWidget";
import StringListField from "@/components/rjsf/StringListField";
import AppLayout from "@/components/AppLayout";
import EmptyEntityPage from "@/components/EmptyEntityPage";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import ValidationButton from "@/components/ValidationButton";
import { useAppState } from "@/contexts/AppStateContext";
import { validateExperiment } from "@/utils/validation";
import { useFormValidation } from "@/hooks/useFormValidation";
import fieldExperimentUiSchema from "./fieldExperimentUiSchema";
import modelUiSchema from "./modelUiSchema";
import { cleanFormDataForType, getExperimentSchemaType, enforceModelExclusivity } from "@/utils/experimentFields";
import {
  cleanupConditionalFields,
  cleanupNestedConditionalFields,
  type ConditionalFieldPair,
  type NestedConditionalFieldPair
} from "@/utils/conditionalFields";
import {
  getInSituExperimentSchema,
  getModelSchema,
  getInterventionSchema,
  getTracerSchema,
  getInterventionWithTracerSchema
} from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { experimentCustomValidate } from "@/utils/customValidators";
import { cleanFormData, isFormEmpty } from "@/utils/formDataCleanup";

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
  },
  {
    triggerField: "tracer_form",
    triggerValue: "other",
    customField: "tracer_form_custom"
  }
];

// Conditional field pairs nested inside array fields
const MODEL_NESTED_CONDITIONAL_FIELDS: NestedConditionalFieldPair[] = [
  {
    arrayField: "model_components",
    triggerField: "model_component_type",
    triggerValue: "other",
    customField: "model_component_type_custom"
  }
];

export default function ExperimentPage() {
  const { state, replaceExperimentFormData, setActiveTab, setExperimentValidation } =
    useAppState();

  const [activeSchema, setActiveSchema] = useState<any>(() => getInSituExperimentSchema());
  const [activeUiSchema, setActiveUiSchema] = useState<any>(fieldExperimentUiSchema);
  const [formData, setFormData] = useState<any>({});
  const isInitialLoadRef = useRef(true);

  const activeExperimentId = state.activeExperimentId;

  const onValidationStatusChange = useCallback(
    (status: boolean | null) => {
      if (activeExperimentId) setExperimentValidation(activeExperimentId, status);
    },
    [activeExperimentId, setExperimentValidation]
  );

  // AJV validation result, memoized on form data. Split by err.name.
  const validationResult = useMemo(
    () => validateExperiment(formData),
    [formData]
  );
  const missingRequired = useMemo(
    () => validationResult.errors.filter((e) => e.name === "required").length,
    [validationResult]
  );
  const otherErrors = validationResult.errors.length - missingRequired;
  const isEmpty = useMemo(() => isFormEmpty(formData), [formData]);

  const validation = useFormValidation({
    missingRequired,
    otherErrors,
    isEmpty,
    onStatusChange: onValidationStatusChange
  });

  // Hide required-field errors from inline display unless the user has
  // explicitly clicked the badge to reveal the full error list. Required
  // fields are obvious from the asterisks — non-required errors (format,
  // pattern, cross-field) still surface immediately on blur.
  const filteredTransformErrors = useMemo(() => {
    return (errors: any[]) => {
      const filtered = validation.showErrorList
        ? errors
        : errors.filter((e) => e.name !== "required");
      return transformFormErrors(filtered);
    };
  }, [validation.showErrorList]);

  const experiment = activeExperimentId
    ? state.experiments.find((exp) => exp.id === activeExperimentId)
    : null;

  useEffect(() => {
    setActiveTab("experiment");
  }, [setActiveTab]);

  // Load experiment data when experiment ID changes
  useEffect(() => {
    // Reset initial load flag when switching experiments — ref updates
    // synchronously, so there's no window where the guard is stale.
    isInitialLoadRef.current = true;
    // Reset error-list visibility so the new entity doesn't inherit
    // the previous one's open/closed state.
    validation.closeErrorList();

    if (experiment) {
      // Use experiment's formData directly - project_id is managed by linking system
      setFormData(experiment.formData);
      // Keep the guard up through RJSF's reconciliation onChange (which fires
      // in a React effect after the render triggered by setFormData), then drop it.
      const timerId = setTimeout(() => { isInitialLoadRef.current = false; }, 0);
      return () => clearTimeout(timerId);
    }
  }, [activeExperimentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic schema and uiSchema switching based on experiment_types
  // See docs/experiment-type-multi-select.md for the full decision table
  useEffect(() => {
    const schemaType = getExperimentSchemaType(formData.experiment_types ?? []);

    // Schema selection — see docs/experiment-type-multi-select.md
    const schemaMap: Record<string, () => any> = {
      intervention: getInterventionSchema,
      tracer_study: getTracerSchema,
      intervention_with_tracer: getInterventionWithTracerSchema,
      model: getModelSchema
    };
    setActiveSchema((schemaMap[schemaType] || getInSituExperimentSchema)());
    setActiveUiSchema(schemaType === "model" ? modelUiSchema : fieldExperimentUiSchema);
  }, [formData.experiment_types]);

  const handleFormChange = useCallback(
    (e: any) => {
      // Don't save to global state until initial data is loaded
      // This prevents RJSF's onChange on mount from overwriting real data with empty data
      if (isInitialLoadRef.current) {
        return;
      }

      let newData = e.formData;

      // Enforce model exclusivity (model can't combine with other types)
      if (Array.isArray(newData.experiment_types)) {
        const previousTypes = Array.isArray(formData.experiment_types)
          ? formData.experiment_types
          : [];
        const cleaned = enforceModelExclusivity(
          newData.experiment_types,
          previousTypes
        );
        if (cleaned !== newData.experiment_types) {
          newData = { ...newData, experiment_types: cleaned };
        }
      }

      // Check if schema type changed and clean fields that don't belong
      const oldSchemaType = getExperimentSchemaType(formData.experiment_types ?? []);
      const newSchemaType = getExperimentSchemaType(newData.experiment_types ?? []);

      if (oldSchemaType !== newSchemaType) {
        newData = cleanFormDataForType(newData, newSchemaType);
      }

      // Clean up conditional custom fields when trigger conditions are not met
      // This prevents orphaned fields from rendering as "additional properties"
      newData = cleanupConditionalFields(newData, EXPERIMENT_CONDITIONAL_FIELDS);
      newData = cleanupNestedConditionalFields(newData, MODEL_NESTED_CONDITIONAL_FIELDS);
      newData = cleanFormData(newData);

      setFormData(newData);
      if (activeExperimentId) {
        // Full replacement (not merge) so cleared fields actually take
        // effect — updateExperiment merges into existing formData which
        // would silently re-introduce removed keys.
        replaceExperimentFormData(activeExperimentId, newData);
      }
    },
    [formData, activeExperimentId, replaceExperimentFormData]
  );

  if (!experiment) {
    return (
      <EmptyEntityPage
        title="No Experiment Selected"
        description="Please create or select an experiment from the Overview page."
      />
    );
  }

  return (
    <AppLayout noScroll>
      <div

        style={{
          flex: 1,
          overflow: "auto"
        }}
      >
        <Container size="md" py="lg">
          <Stack gap="sm" mb="md">
            <Group align="center" gap="md">
              <Title order={2}>{experiment.name || "Experiment"}</Title>
              <ValidationButton
                badgeState={validation.badgeState}
                missingRequired={validation.missingRequired}
                otherErrors={validation.otherErrors}
                onClick={validation.handleClick}
              />
            </Group>
            <Text c="dimmed">
              Edit experiment metadata. Fields marked with an asterisk (*) are
              required.
            </Text>
          </Stack>

          <Form
            ref={validation.formRef}
            schema={activeSchema}
            uiSchema={activeUiSchema}
            formData={formData}
            onChange={handleFormChange}
            validator={validator}
            customValidate={experimentCustomValidate}
            transformErrors={filteredTransformErrors}
            liveValidate
            noHtml5Validate
            formContext={{ onCloseErrorList: validation.closeErrorList }}
            omitExtraData={false}
            liveOmit={false}
            experimental_defaultFormStateBehavior={{
              arrayMinItems: { populate: "never" },
              emptyObjectFields: "skipEmptyDefaults",
              constAsDefaults: "never"
            }}
            widgets={{
              CustomSelectWidget: CustomSelectWidget,
              TextWidget: BaseInputWidget,
              textarea: CustomTextareaWidget,
              DateTimeWidget: DateTimeWidget,
              PlaceholderWidget: PlaceholderWidget,
              DosingDepthWidget: DosingDepthWidget,
              LockableIdWidget: LockableIdWidget
            }}
            templates={{
              DescriptionFieldTemplate: NoDescription,
              FieldTemplate: CustomFieldTemplate,
              ObjectFieldTemplate: ResponsiveObjectFieldTemplate,
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
              DosingConcentrationField: DosingConcentrationField,
              StringListField: StringListField
            }}
            showErrorList={validation.showErrorList ? "top" : false}
          />
        </Container>
      </div>

      <JsonPreviewSidebar data={formData} />
    </AppLayout>
  );
}
