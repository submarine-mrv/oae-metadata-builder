import { Container, Group, Stack, Text, Title } from "@mantine/core";
import Form from "@rjsf/mantine";
import type { DescriptionFieldProps, RJSFValidationError } from "@rjsf/utils";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import EmptyEntityPage from "@/components/EmptyEntityPage";
import FilenamesField from "@/components/FilenamesField";
import IsoIntervalWidget from "@/components/IsoIntervalWidget";
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
import LinkedExperimentIdWidget from "@/components/rjsf/LinkedExperimentIdWidget";
import ResponsiveObjectFieldTemplate from "@/components/rjsf/ResponsiveObjectFieldTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import ValidationButton from "@/components/ValidationButton";
import VariablesField from "@/components/VariablesField";
import { useAppState } from "@/contexts/AppStateContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { type ConditionalFieldPair, cleanupConditionalFields } from "@/utils/conditionalFields";
import { cleanDatasetFormDataForType } from "@/utils/datasetFields";
import { transformFormErrors } from "@/utils/errorTransformer";
import { cleanFormData, isFormEmpty } from "@/utils/formDataCleanup";
import { getFieldDatasetSchema, getModelOutputDatasetSchema } from "@/utils/schemaViews";
import { validateDataset } from "@/utils/validation";
import modelOutputUiSchema from "./modelOutputUiSchema";
import fieldDatasetUiSchema from "./uiSchema";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

// Conditional field pairs for model output dataset forms
// simulation_type is now multivalued — mcdr_forcing_description should appear
// when "perturbation" is one of the selected values
const DATASET_CONDITIONAL_FIELDS: ConditionalFieldPair[] = [
  {
    triggerField: "simulation_type",
    triggerValue: "perturbation",
    customField: "mcdr_forcing_description",
    matchMode: "array-contains",
  },
];

/**
 * Builds the FieldDataset schema the RJSF *form* renders from.
 *
 * The `variables` array is rendered by the custom VariablesField (and edited via
 * the Variable Modal), not by RJSF's generic array/oneOf rendering — so the form
 * schema replaces `variables` with a plain `array` to keep RJSF from rendering
 * the polymorphic item schema. Variable *validation* is not skipped: it happens
 * in the unified validateDataset() pass against the discriminated schema, and
 * those per-variable errors are injected into the form's error list below.
 */
function createFieldDatasetFormSchema() {
  const schema = getFieldDatasetSchema();

  // Render variables via VariablesField, not RJSF's generic array UI, so replace
  // the item schema with a plain array. Validation stays in validateDataset().
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
        description,
      },
    };
  }

  return schema;
}

function isModelOutputType(datasetType: string | undefined): boolean {
  return datasetType === "model_output";
}

export default function DatasetPage() {
  const { state, replaceDatasetFormData, getDataset, setActiveTab, setDatasetValidation } =
    useAppState();

  // Dynamic schema/uiSchema switching based on dataset_type
  const [activeSchema, setActiveSchema] = useState<any>(() => createFieldDatasetFormSchema());
  const [activeUiSchema, setActiveUiSchema] = useState<any>(fieldDatasetUiSchema);

  // Local form data state — decoupled from context to prevent stale fields
  // on type switch (updateDataset uses merge semantics which would re-add
  // fields that cleanup removed)
  const [formData, setFormData] = useState<any>({});

  // Get current dataset
  const currentDataset = state.activeDatasetId ? getDataset(state.activeDatasetId) : null;

  // Load dataset data when active dataset changes
  useEffect(() => {
    if (currentDataset) {
      setFormData(currentDataset.formData);
    }
  }, [state.activeDatasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasExperiments = state.experiments.length > 0;

  const onValidationStatusChange = useCallback(
    (status: boolean | null) => {
      if (state.activeDatasetId) setDatasetValidation(state.activeDatasetId, status);
    },
    [state.activeDatasetId, setDatasetValidation],
  );

  // AJV validation result, memoized on form data. Handles the polymorphic
  // variable workaround internally via validateDataset().
  const validationResult = useMemo(
    () => validateDataset(formData, { hasExperiments }),
    [formData, hasExperiments],
  );
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
    onStatusChange: onValidationStatusChange,
  });

  // Reset error-list visibility when switching active dataset so the
  // new one doesn't inherit the previous one's open/closed state.
  useEffect(() => {
    validation.closeErrorList();
  }, [state.activeDatasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref for formData so transformErrors can access latest data without
  // being recreated on every keystroke
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Dynamic schema switching based on dataset_type
  useEffect(() => {
    const datasetType = formData.dataset_type;

    if (isModelOutputType(datasetType)) {
      setActiveSchema(getModelOutputDatasetSchema());
      setActiveUiSchema(modelOutputUiSchema);
    } else {
      setActiveSchema(createFieldDatasetFormSchema());
      setActiveUiSchema(fieldDatasetUiSchema);
    }
  }, [formData.dataset_type]);

  // Wrap error transformer to:
  // 1. Suppress experiment_id errors when no experiments exist
  // 2. Inject per-variable validation errors from validateDataset (the form
  //    schema renders variables via VariablesField and omits their item schema)
  const customTransformErrors = useMemo(() => {
    return (errors: RJSFValidationError[]) => {
      // Hide required-field errors from inline display unless the user has
      // explicitly clicked the badge to reveal the full error list.
      const preFiltered = validation.showErrorList
        ? errors
        : errors.filter((e) => e.name !== "required");
      let transformed = transformFormErrors(preFiltered);
      if (!hasExperiments) {
        transformed = transformed.filter(
          (e) =>
            !(
              e.name === "required" &&
              (e.params?.missingProperty === "experiment_id" || e.property === ".experiment_id")
            ),
        );
      }

      // Inject per-variable errors into RJSF's error list. The form schema omits
      // the variable item schema (variables are rendered by VariablesField), so
      // validateDataset is the source of variable validation.
      // Only applies to FieldDataset (ModelOutputDataset has no variables field).
      if (!isModelOutputType(formDataRef.current.dataset_type)) {
        const datasetResult = validateDataset(formDataRef.current, { hasExperiments });
        const variableErrors = datasetResult.errors.filter((e) => e.name === "variable");
        if (variableErrors.length > 0) {
          transformed = [...transformed, ...variableErrors];
        }
      }

      return transformed;
    };
  }, [hasExperiments, validation.showErrorList]);

  useEffect(() => {
    setActiveTab("dataset");
  }, [setActiveTab]);

  const handleFormChange = useCallback(
    (e: any) => {
      if (!state.activeDatasetId) return;

      let newData = e.formData;

      // Check if dataset_type changed
      const oldType = formData.dataset_type;
      const newType = newData.dataset_type;

      if (newType && oldType !== newType) {
        // Dataset type changed — clean fields that don't belong to new type.
        // Note: oldType can be undefined on first selection (fresh dataset),
        // so we don't guard on oldType being truthy.
        newData = cleanDatasetFormDataForType(newData, newType);
      }

      // Clean up conditional custom fields for model output datasets
      if (isModelOutputType(newData.dataset_type)) {
        newData = cleanupConditionalFields(newData, DATASET_CONDITIONAL_FIELDS);
      }
      newData = cleanFormData(newData);

      // Update local state first (form sees cleaned data immediately),
      // then sync to context
      setFormData(newData);
      replaceDatasetFormData(state.activeDatasetId, newData);
    },
    [formData, state.activeDatasetId, replaceDatasetFormData],
  );

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
        style={{
          flex: 1,
          overflow: "auto",
        }}
      >
        <Container size="md" py="lg">
          <Stack gap="sm">
            <Group align="center" gap="md">
              <Title order={2}>Dataset Metadata: {currentDataset.name}</Title>
              <ValidationButton
                badgeState={validation.badgeState}
                missingRequired={validation.missingRequired}
                otherErrors={validation.otherErrors}
                onClick={validation.handleClick}
              />
            </Group>
            <Text c="dimmed">
              Define metadata for your dataset including data files, platform information, and
              variable specifications.
            </Text>
          </Stack>

          <Form
            ref={validation.formRef}
            schema={activeSchema}
            uiSchema={activeUiSchema}
            formData={formData}
            onChange={handleFormChange}
            validator={validator}
            transformErrors={customTransformErrors}
            omitExtraData={false}
            liveOmit={false}
            liveValidate
            noHtml5Validate
            formContext={{ onCloseErrorList: validation.closeErrorList }}
            experimental_defaultFormStateBehavior={{
              arrayMinItems: { populate: "never" },
              emptyObjectFields: "skipEmptyDefaults",
              constAsDefaults: "never",
            }}
            fields={{
              FilenamesField: FilenamesField,
              VariablesField: VariablesField,
            }}
            widgets={{
              IsoIntervalWidget,
              CustomSelectWidget: CustomSelectWidget,
              TextWidget: BaseInputWidget,
              textarea: CustomTextareaWidget,
              LinkedExperimentIdWidget: LinkedExperimentIdWidget,
              DateTimeWidget: DateTimeWidget,
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
            showErrorList={validation.showErrorList ? "top" : false}
          />
        </Container>
      </div>

      <JsonPreviewSidebar data={formData} />
    </AppLayout>
  );
}
