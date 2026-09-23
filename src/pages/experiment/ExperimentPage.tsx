import { Container, Group, Stack, Text, Title } from "@mantine/core";
import Form from "@rjsf/mantine";
import type { DescriptionFieldProps, RJSFSchema, UiSchema } from "@rjsf/utils";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import { useAtomValue, useSetAtom } from "jotai";
import type React from "react";
import { useCallback, useEffect, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import DosingLocationField from "@/components/DosingLocationField";
import EmptyEntityPage from "@/components/EmptyEntityPage";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import CustomFieldTemplate from "@/components/rjsf/CustomFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import DateTimeWidget from "@/components/rjsf/DateTimeWidget";
import DateWidget from "@/components/rjsf/DateWidget";
import DosingConcentrationField from "@/components/rjsf/DosingConcentrationField";
import DosingDepthWidget from "@/components/rjsf/DosingDepthWidget";
import LockableIdWidget from "@/components/rjsf/LockableIdWidget";
import PlaceholderField from "@/components/rjsf/PlaceholderField";
import PlaceholderWidget from "@/components/rjsf/PlaceholderWidget";
import ResponsiveObjectFieldTemplate from "@/components/rjsf/ResponsiveObjectFieldTemplate";
import StringListField from "@/components/rjsf/StringListField";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import SpatialCoverageField from "@/components/SpatialCoverageField";
import ValidationButton from "@/components/ValidationButton";
import { useFormValidation } from "@/hooks/useFormValidation";
import { replaceExperimentFormDataAtom } from "@/state/actions";
import { activeExperimentIdAtom } from "@/state/atoms";
import { useExperiment } from "@/state/hooks";
import type { DraftExperiment } from "@/types/forms";
import { experimentCustomValidate } from "@/utils/customValidators";
import { transformFormErrors } from "@/utils/errorTransformer";
import { getExperimentSchemaType } from "@/utils/experimentFields";
import { isFormEmpty } from "@/utils/formDataCleanup";
import { parseExperiment } from "@/utils/parseEntity";
import {
  getInSituExperimentSchema,
  getInterventionSchema,
  getInterventionWithTracerSchema,
  getModelSchema,
  getTracerSchema,
} from "@/utils/schemaViews";
import { validateExperiment } from "@/utils/validation";
import fieldExperimentUiSchema from "./fieldExperimentUiSchema";
import modelUiSchema from "./modelUiSchema";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

const NO_DATA: DraftExperiment = {};

// Schema selection: see docs/experiment-type-multi-select.md
const schemaGetters: Record<string, () => RJSFSchema> = {
  intervention: getInterventionSchema,
  tracer_study: getTracerSchema,
  intervention_with_tracer: getInterventionWithTracerSchema,
  model: getModelSchema,
};

const formsByType = new Map<string, { schema: RJSFSchema; uiSchema: UiSchema }>();

/** The schema and uiSchema for a schema type, one object per type since RJSF caches by identity. */
function experimentForm(schemaType: string) {
  let form = formsByType.get(schemaType);
  if (!form) {
    form = {
      schema: (schemaGetters[schemaType] ?? getInSituExperimentSchema)(),
      uiSchema: schemaType === "model" ? modelUiSchema : fieldExperimentUiSchema,
    };
    formsByType.set(schemaType, form);
  }
  return form;
}

export default function ExperimentPage() {
  const activeExperimentId = useAtomValue(activeExperimentIdAtom);
  const replaceExperimentFormData = useSetAtom(replaceExperimentFormDataAtom);

  const experiment = useExperiment(activeExperimentId);
  const formData = experiment?.formData ?? NO_DATA;
  const { schema: activeSchema, uiSchema: activeUiSchema } = experimentForm(
    getExperimentSchemaType(formData.experiment_types ?? []),
  );

  // AJV validation result, memoized on form data. Split by err.name.
  const validationResult = useMemo(() => validateExperiment(formData), [formData]);
  const missingRequired = useMemo(
    () => validationResult.errors.filter((e) => e.name === "required").length,
    [validationResult],
  );
  const otherErrors = validationResult.errors.length - missingRequired;
  const isEmpty = useMemo(() => isFormEmpty(formData), [formData]);

  const validation = useFormValidation({
    missingRequired,
    otherErrors,
    isEmpty,
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
      return transformFormErrors(filtered, activeSchema);
    };
  }, [validation.showErrorList, activeSchema]);

  // Reset error-list visibility so the new entity doesn't inherit
  // the previous one's open/closed state.
  useEffect(() => {
    validation.closeErrorList();
  }, [activeExperimentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormChange = useCallback(
    (e: any) => {
      if (!activeExperimentId) return;

      // The parse boundary: model exclusivity, type-scoped field cleanup,
      // conditional-field cleanup, and empty-value cleanup in one pass.
      // The record's formData as prev enables the type-transition recency rule.
      // Full replacement, so cleared fields stay cleared.
      replaceExperimentFormData(activeExperimentId, parseExperiment(e.formData, formData));
    },
    [formData, activeExperimentId, replaceExperimentFormData],
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
          overflow: "auto",
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
              Edit experiment metadata. Fields marked with an asterisk (*) are required.
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
              constAsDefaults: "never",
            }}
            widgets={{
              // RJSF picks `DateWidget` by name for `format: date`.
              DateWidget,
              CustomSelectWidget: CustomSelectWidget,
              TextWidget: BaseInputWidget,
              textarea: CustomTextareaWidget,
              DateTimeWidget: DateTimeWidget,
              PlaceholderWidget: PlaceholderWidget,
              DosingDepthWidget: DosingDepthWidget,
              LockableIdWidget: LockableIdWidget,
            }}
            templates={{
              DescriptionFieldTemplate: NoDescription,
              FieldTemplate: CustomFieldTemplate,
              ObjectFieldTemplate: ResponsiveObjectFieldTemplate,
              ArrayFieldTemplate: CustomArrayFieldTemplate,
              ArrayFieldTitleTemplate: CustomArrayFieldTitleTemplate,
              ArrayFieldItemButtonsTemplate: CustomArrayFieldItemButtonsTemplate,
              TitleFieldTemplate: CustomTitleFieldTemplate,
              ErrorListTemplate: CustomErrorList,
              ButtonTemplates: {
                AddButton: CustomAddButton,
                SubmitButton: HiddenSubmitButton,
              },
            }}
            fields={{
              SpatialCoverageMiniMap: SpatialCoverageField,
              PlaceholderField: PlaceholderField,
              DosingLocationField: DosingLocationField,
              DosingConcentrationField: DosingConcentrationField,
              StringListField: StringListField,
            }}
            showErrorList={validation.showErrorList ? "top" : false}
          />
        </Container>
      </div>

      <JsonPreviewSidebar data={formData} />
    </AppLayout>
  );
}
