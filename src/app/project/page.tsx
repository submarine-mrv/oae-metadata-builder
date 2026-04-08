"use client";
import React, { useEffect, useMemo, useState } from "react";
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

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import SeaNamesAutocompleteWidget from "@/components/SeaNamesAutocompleteWidget";
import uiSchema from "./uiSchema";
import SpatialCoverageField from "@/components/SpatialCoverageField";
import ExternalProjectField from "@/components/ExternalProjectField";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import ResponsiveObjectFieldTemplate from "@/components/rjsf/ResponsiveObjectFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import LockableIdWidget from "@/components/rjsf/LockableIdWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import CustomFieldTemplate from "@/components/rjsf/CustomFieldTemplate";
import AppLayout from "@/components/AppLayout";
import EmptyEntityPage from "@/components/EmptyEntityPage";
import JsonPreviewSidebar from "@/components/JsonPreviewSidebar";
import ValidationButton from "@/components/ValidationButton";
import { useAppState } from "@/contexts/AppStateContext";
import { getProjectSchema } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { validateProject } from "@/utils/validation";
import { projectCustomValidate } from "@/utils/customValidators";
import { isFormEmpty } from "@/utils/formDataCleanup";
import { useFormValidation } from "@/hooks/useFormValidation";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

export default function ProjectPage() {
  const {
    state,
    updateProjectData,
    setActiveTab,
    setProjectValidation
  } = useAppState();
  const [schema] = useState<any>(() => getProjectSchema());

  // Source of truth for badge counts: run AJV via validateProject, memoized
  // on form data. Filter by err.name to split missing-required from others.
  const validationResult = useMemo(
    () => validateProject(state.projectData),
    [state.projectData]
  );
  const missingRequired = useMemo(
    () => validationResult.errors.filter((e) => e.name === "required").length,
    [validationResult]
  );
  const otherErrors = validationResult.errors.length - missingRequired;
  const isEmpty = useMemo(() => isFormEmpty(state.projectData), [state.projectData]);

  const validation = useFormValidation({
    missingRequired,
    otherErrors,
    isEmpty,
    onStatusChange: setProjectValidation
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

  useEffect(() => {
    setActiveTab("project");
  }, [setActiveTab]);

  if (!state.hasProject) {
    return (
      <EmptyEntityPage
        title="No Project Created"
        description="Please create a project from the Overview page."
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
          <Stack gap="sm">
            <Group align="center" gap="md">
              <Title order={2}>Project Metadata</Title>
              <ValidationButton
                badgeState={validation.badgeState}
                missingRequired={validation.missingRequired}
                otherErrors={validation.otherErrors}
                onClick={validation.handleClick}
              />
            </Group>
            <Text c="dimmed">
              Create standardized metadata for your Ocean Alkalinity
              Enhancement project. Click the info icons next to field labels
              for detailed descriptions.
            </Text>
          </Stack>

          <Form
            ref={validation.formRef}
            schema={schema}
            uiSchema={uiSchema}
            formData={state.projectData}
            onChange={(e) => {
              updateProjectData(e.formData);
            }}
            validator={validator}
            customValidate={projectCustomValidate}
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
              IsoIntervalWidget,
              SeaNamesAutocomplete: SeaNamesAutocompleteWidget,
              CustomSelectWidget: CustomSelectWidget,
              TextWidget: BaseInputWidget,
              textarea: CustomTextareaWidget,
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
              ExternalProjectField: ExternalProjectField
            }}
            showErrorList={validation.showErrorList ? "top" : false}
          />
        </Container>
      </div>

      <JsonPreviewSidebar data={state.projectData} />
    </AppLayout>
  );
}
