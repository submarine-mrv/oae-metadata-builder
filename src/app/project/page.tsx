"use client";
import React, { useEffect, useState } from "react";
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
import SeaNamesAutocompleteWidget from "@/components/SeaNamesAutocompleteWidget";
import uiSchema from "./uiSchema";
import SpatialCoverageField from "@/components/SpatialCoverageField";
import ExternalProjectField from "@/components/ExternalProjectField";
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
import { useAppState } from "@/contexts/AppStateContext";
import { getProjectSchema } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { useDownloadModal } from "@/hooks/useDownloadModal";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Hidden submit button - we don't use RJSF's submit anymore
const HiddenSubmitButton = () => null;

export default function ProjectPage() {
  const {
    state,
    updateProjectData,
    setActiveTab
  } = useAppState();
  const [schema] = useState<any>(() => getProjectSchema());

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
    defaultSelection: "project"
  });

  useEffect(() => {
    setActiveTab("project");
  }, [setActiveTab]);

  const customValidate = (data: any, errors: any) => {
    const t = data?.temporal_coverage as string | undefined;
    if (!t) errors?.temporal_coverage?.addError("Start date is required.");
    else {
      const [start, end] = t.split("/");
      if (start && end && end !== "..") {
        const s = +new Date(start),
          e = +new Date(end);
        if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
          errors?.temporal_coverage?.addError("End date must be ≥ start date.");
        }
      }
    }

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
            <Group justify="space-between" align="center">
              <Title order={2}>Project Metadata</Title>
            </Group>
            <Text c="dimmed">
              Create standardized metadata for your Ocean Alkalinity
              Enhancement project. Click the info icons next to field labels
              for detailed descriptions.
            </Text>
          </Stack>

          <Form
            schema={schema}
            uiSchema={uiSchema}
            formData={state.projectData}
            onChange={(e) => updateProjectData(e.formData)}
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
              IsoIntervalWidget,
              SeaNamesAutocomplete: SeaNamesAutocompleteWidget,
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
            fields={{
              SpatialCoverageMiniMap: SpatialCoverageField,
              ExternalProjectField: ExternalProjectField
            }}
            showErrorList={false}
          />

          {/* Download button - bypasses RJSF validation */}
          <Group justify="flex-end" mt="xl">
            <Button
              leftSection={<IconDownload size={18} />}
              onClick={openModal}
            >
              Download Project Metadata
            </Button>
          </Group>
        </Container>
      </div>

      <JsonPreviewSidebar data={state.projectData} />

      <DownloadModal
        opened={showModal}
        onClose={closeModal}
        onDownload={handleDownload}
        title="Download Metadata"
        sections={sections}
        onSectionToggle={handleSectionToggle}
      />
    </AppLayout>
  );
}
