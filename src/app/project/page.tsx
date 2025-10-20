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
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import SeaNamesAutocompleteWidget from "@/components/SeaNamesAutocompleteWidget";
import uiSchema from "../uiSchema";
import SpatialCoverageFlatField from "@/components/SpatialCoverageFlatField";
import SpatialCoverageMiniMap from "@/components/SpatialCoverageMiniMap";
import ExternalProjectField from "@/components/ExternalProjectField";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomSubmitButton from "@/components/rjsf/CustomSubmitButton";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import Navigation from "@/components/Navigation";
import { useAppState } from "@/contexts/AppStateContext";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

export default function ProjectPage() {
  const { state, updateProjectData, setActiveTab, setTriggerValidation } =
    useAppState();
  const [schema, setSchema] = useState<any>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [forceValidation, setForceValidation] = useState(false);

  useEffect(() => {
    setActiveTab("project");
  }, [setActiveTab]);

  // Trigger validation if requested (e.g., from export button)
  useEffect(() => {
    if (state.triggerValidation) {
      // Scroll to top of page
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Trigger validation by forcing a form submit
      setTimeout(() => {
        setForceValidation(true);
        setTriggerValidation(false);
      }, 100);
    }
  }, [state.triggerValidation, setTriggerValidation]);

  // Trigger form submission when forceValidation is true
  useEffect(() => {
    if (forceValidation) {
      // Find and click the submit button
      const submitButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;
      if (submitButton) {
        submitButton.click();
      }
      setForceValidation(false);
    }
  }, [forceValidation]);

  const downloadJsonFile = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oae-project-metadata.json";
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
      if (
        (e.property === ".spatial_coverage.geo.box" && e.name === "required") ||
        (e.property === ".spatial_coverage.geo" && e.name === "required") ||
        (e.property === ".spatial_coverage" && e.name === "required") ||
        (e.property === "." &&
          e.name === "required" &&
          e.params?.missingProperty === "spatial_coverage")
      ) {
        return {
          ...e,
          property: ".spatial_coverage", // Normalize property to spatial_coverage level
          message: "Spatial Coverage is required"
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

  if (!schema) return null;

  return (
    <div>
      <Navigation />
      <div style={{ display: "flex", height: "calc(100vh - 60px)" }}>
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
                <Title order={2}>Project Metadata</Title>
                {/*<Button*/}
                {/*  variant={showJsonPreview ? "filled" : "outline"}*/}
                {/*  leftSection={<IconCode size={16} />}*/}
                {/*  onClick={() => setShowJsonPreview(!showJsonPreview)}*/}
                {/*>*/}
                {/*  JSON Preview*/}
                {/*</Button>*/}
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
              onSubmit={({ formData }) => downloadJsonFile(formData)}
              validator={validator}
              customValidate={customValidate}
              transformErrors={transformErrors}
              omitExtraData={false}
              liveOmit={false}
              experimental_defaultFormStateBehavior={{
                arrayMinItems: { populate: "all" }
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
                ArrayFieldItemButtonsTemplate:
                  CustomArrayFieldItemButtonsTemplate,
                TitleFieldTemplate: CustomTitleFieldTemplate,
                ErrorListTemplate: CustomErrorList,
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
              showErrorList="top"
            />
          </Container>
        </div>

        {showJsonPreview && (
          <Box
            style={{
              position: "fixed",
              right: 0,
              top: 60,
              width: sidebarWidth,
              height: "calc(100vh - 60px)",
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
                {JSON.stringify(state.projectData, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
      </div>
    </div>
  );
}
