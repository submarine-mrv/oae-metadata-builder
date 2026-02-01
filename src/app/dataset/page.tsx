"use client";
import React, { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Box,
  Group
} from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps, SubmitButtonProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import uiSchema from "./uiSchema";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomArrayFieldTitleTemplate from "@/components/rjsf/ArrayFieldTitleTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomSubmitButton from "@/components/rjsf/CustomSubmitButton";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import AppLayout from "@/components/AppLayout";
import DownloadConfirmationModal from "@/components/DownloadConfirmationModal";
import FilenamesField from "@/components/FilenamesField";
import VariablesField from "@/components/VariablesField";
import { useAppState } from "@/contexts/AppStateContext";
import { getDatasetSchema } from "@/utils/schemaViews";
import { transformFormErrors } from "@/utils/errorTransformer";
import { useMetadataDownload } from "@/hooks/useMetadataDownload";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

// Create a wrapper for the submit button with dataset-specific configuration
const DatasetSubmitButton = (props: SubmitButtonProps) => (
  <CustomSubmitButton {...props} buttonText="Download Dataset Metadata" />
);

export default function DatasetPage() {
  const { state, updateDataset, getDataset, setActiveTab, setShowJsonPreview } =
    useAppState();
  const [schema] = useState<any>(() => getDatasetSchema());
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [skipDownload, setSkipDownload] = useState(false);

  // Get current dataset
  const currentDataset = state.activeDatasetId
    ? getDataset(state.activeDatasetId)
    : null;

  const formData = currentDataset?.formData || {};

  const {
    showDownloadModal,
    handleFormSubmit,
    handleDownloadConfirm,
    handleDownloadCancel
  } = useMetadataDownload({
    filename: "oae-dataset-metadata.json",
    skipDownload,
    onSkipDownloadChange: setSkipDownload
  });

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
            schema={schema}
            uiSchema={uiSchema}
            formData={formData}
            onChange={handleFormChange}
            onSubmit={handleFormSubmit}
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
                SubmitButton: DatasetSubmitButton
              }
            }}
            showErrorList="top"
          />
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

      <DownloadConfirmationModal
        opened={showDownloadModal}
        onClose={handleDownloadCancel}
        onConfirm={handleDownloadConfirm}
        metadataType="dataset"
        title="Download Dataset Metadata"
      />
    </AppLayout>
  );
}
