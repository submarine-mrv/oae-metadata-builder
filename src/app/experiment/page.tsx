"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Stack,
  Button,
  Box,
  Group
} from "@mantine/core";
import { IconCode, IconX, IconArrowLeft } from "@tabler/icons-react";
import Form from "@rjsf/mantine";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2019 from "ajv/dist/2019";
import type { DescriptionFieldProps } from "@rjsf/utils";

import SpatialCoverageMiniMap from "@/components/SpatialCoverageMiniMap";
import DosingLocationWidget from "@/components/DosingLocationWidget";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";
import CustomAddButton from "@/components/rjsf/CustomAddButton";
import CustomArrayFieldTemplate from "@/components/rjsf/CustomArrayFieldTemplate";
import CustomSelectWidget from "@/components/rjsf/CustomSelectWidget";
import CustomSubmitButton from "@/components/rjsf/CustomSubmitButton";
import BaseInputWidget from "@/components/rjsf/BaseInputWidget";
import CustomTextareaWidget from "@/components/rjsf/CustomTextareaWidget";
import CustomErrorList from "@/components/rjsf/CustomErrorList";
import DateTimeWidget from "@/components/rjsf/DateTimeWidget";
import PlaceholderWidget from "@/components/rjsf/PlaceholderWidget";
import PlaceholderField from "@/components/rjsf/PlaceholderField";
import DosingConcentrationField from "@/components/rjsf/DosingConcentrationField";
import DosingDepthWidget from "@/components/rjsf/DosingDepthWidget";
import Navigation from "@/components/Navigation";
import { useAppState } from "@/contexts/AppStateContext";
import experimentUiSchema from "./experimentUiSchema";
import interventionUiSchema from "./interventionUiSchema";
import tracerUiSchema from "./tracerUiSchema";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

// Create validator with Draft 2019-09 support
const validator = customizeValidator({ AjvClass: Ajv2019 });

export default function ExperimentPage() {
  const router = useRouter();
  const { state, updateExperiment, setActiveTab, setTriggerValidation } =
    useAppState();

  const [baseSchema, setBaseSchema] = useState<any>(null);
  const [activeSchema, setActiveSchema] = useState<any>(null);
  const [activeUiSchema, setActiveUiSchema] = useState<any>(experimentUiSchema);
  const [formData, setFormData] = useState<any>({});
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [forceValidation, setForceValidation] = useState(false);

  const activeExperimentId = state.activeExperimentId;
  const experiment = activeExperimentId
    ? state.experiments.find((exp) => exp.id === activeExperimentId)
    : null;

  useEffect(() => {
    setActiveTab("experiment");
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

  // Load experiment data
  useEffect(() => {
    if (experiment) {
      setFormData({
        ...experiment.formData,
        project_id: state.projectData.project_id || ""
      });
    }
  }, [experiment, state.projectData.project_id]);

  // Load schema
  useEffect(() => {
    // Add timestamp to bust cache
    fetch(`/experiment.schema.bundled.json?t=${Date.now()}`)
      .then((r) => r.json())
      .then(setBaseSchema)
      .catch(console.error);
  }, []);

  // Dynamic schema and uiSchema switching based on experiment_type
  useEffect(() => {
    if (!baseSchema) return;

    const experimentType = formData.experiment_type;

    if (experimentType === "intervention") {
      // Use the Intervention schema from $defs
      const interventionSchema = {
        ...baseSchema.$defs.Intervention,
        $defs: baseSchema.$defs, // Preserve all definitions for references
        $schema: baseSchema.$schema,
        $id: "InterventionSchema",
        additionalProperties: true // IMPORTANT: Explicitly set
        // additionalProperties:true to allow for conditional rendering in allOf
        // blocks to work as expected
      };

      setActiveSchema(interventionSchema);
      setActiveUiSchema(interventionUiSchema);
    } else if (experimentType === "tracer_study") {
      // Use the Tracer schema from $defs
      const tracerSchema = {
        ...baseSchema.$defs.Tracer,
        $defs: baseSchema.$defs, // Preserve all definitions for references
        $schema: baseSchema.$schema,
        $id: "TracerSchema"
      };

      setActiveSchema(tracerSchema);
      setActiveUiSchema(tracerUiSchema);
    } else {
      // Use base Experiment schema (default)
      setActiveSchema(baseSchema);
      setActiveUiSchema(experimentUiSchema);
    }
  }, [baseSchema, formData.experiment_type]);

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
    const newData = e.formData;
    setFormData(newData);
    if (activeExperimentId) {
      updateExperiment(activeExperimentId, newData);
    }
  };

  const downloadJsonFile = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `experiment-${activeExperimentId || "metadata"}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const transformErrors = (errors: any[]) =>
    errors.map((e) => {
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
          property: ".spatial_coverage",
          message: "Spatial Coverage is required"
        };
      }
      return e;
    });

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

  if (!baseSchema || !activeSchema) {
    return (
      <>
        <Navigation />
        <Container size="md" py="lg">
          <Text>Loading experiment schema...</Text>
        </Container>
      </>
    );
  }

  if (!experiment) {
    return (
      <>
        <Navigation />
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
      </>
    );
  }

  return (
    <>
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
              schema={activeSchema}
              uiSchema={activeUiSchema}
              formData={formData}
              onChange={handleFormChange}
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
                SpatialCoverageMiniMap: SpatialCoverageMiniMap,
                PlaceholderField: PlaceholderField,
                DosingLocationField: DosingLocationWidget,
                DosingConcentrationField: DosingConcentrationField
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
                {JSON.stringify(formData, null, 2)}
              </pre>
            </Box>
          </Box>
        )}
      </div>
    </>
  );
}
