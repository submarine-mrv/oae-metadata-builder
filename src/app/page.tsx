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
import { IconCode, IconX } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import validator from "@rjsf/validator-ajv8";
import type { DescriptionFieldProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import SeaNamesAutocompleteWidget from "@/components/SeaNamesAutocompleteWidget";
import uiSchema from "./uiSchema";
import SpatialCoverageFlatField from "@/components/SpatialCoverageFlatField";
import SpatialCoverageMiniMap from "@/components/SpatialCoverageMiniMap";
import ExternalProjectField from "@/components/ExternalProjectField";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomSubmitButton from "@/components/rjsf/CustomSubmitButton";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

export default function Page() {
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    project_id: "" // Fix controlled/uncontrolled input warning for text input fields
  });
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

  const downloadJsonFile = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oae-metadata.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetch("/schema.bundled.json")
      .then((r) => r.json())
      .then(setSchema)
      .catch(console.error);
  }, []);

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

  const transformErrors = (errors: any[]) =>
    errors.map((e) => {
      if (e.property === ".temporal_coverage" && e.name === "pattern") {
        return {
          ...e,
          message:
            "Use ISO interval: YYYY-MM-DD/YYYY-MM-DD or open-ended YYYY-MM-DD/.."
        };
      }
      return e;
    });

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
    return errors;
  };

  if (!schema) return null;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div
        style={{
          flex: 1,
          marginRight: showJsonPreview ? sidebarWidth : 0,
          transition: "margin-right 0.2s ease-in-out",
          overflow: "auto"
        }}
      >
        <Container size="md" py="lg">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <div>
                <Title order={2}>OAE Data Protocol – Metadata Builder</Title>
                <Text c="dimmed">
                  Fill required fields. Long JSON Schema descriptions are
                  hidden; concise tips appear as <code>ui:help</code>.
                </Text>
              </div>
              <Button
                variant={showJsonPreview ? "filled" : "outline"}
                leftSection={<IconCode size={16} />}
                onClick={() => setShowJsonPreview(!showJsonPreview)}
              >
                JSON Preview
              </Button>
            </Group>
          </Stack>

          <Form
            schema={schema}
            uiSchema={uiSchema}
            formData={formData}
            onChange={(e) => setFormData(e.formData)}
            onSubmit={({ formData }) => downloadJsonFile(formData)}
            validator={validator}
            omitExtraData={false}
            liveOmit={false}
            experimental_defaultFormStateBehavior={{
              arrayMinItems: { populate: "all" }
            }}
            widgets={{
              IsoIntervalWidget,
              SeaNamesAutocomplete: SeaNamesAutocompleteWidget,
              CustomSelectWidget: CustomSelectWidget
            }}
            templates={{
              DescriptionFieldTemplate: NoDescription,
              ArrayFieldTemplate: CustomArrayFieldTemplate,
              ArrayFieldItemButtonsTemplate:
                CustomArrayFieldItemButtonsTemplate,
              TitleFieldTemplate: CustomTitleFieldTemplate,
              ButtonTemplates: {
                AddButton: CustomAddButton,
                SubmitButton: CustomSubmitButton
              }
            }}
            fields={{
              SpatialCoverageFlat: SpatialCoverageFlatField,
              SpatialCoverageMiniMap: SpatialCoverageMiniMap,
              ExternalProjectField: ExternalProjectField
            }}
            showErrorList="bottom"
          />
        </Container>
      </div>

      {showJsonPreview && (
        <Box
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: sidebarWidth,
            height: "100vh",
            backgroundColor: "#f8f9fa",
            borderLeft: "1px solid #dee2e6",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000
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
              cursor: "col-resize",
              zIndex: 1001
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
    </div>
  );
}
