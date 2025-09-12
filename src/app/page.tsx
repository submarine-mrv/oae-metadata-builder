"use client";
import React, { useEffect, useState } from "react";
import { Container, Title, Text, Stack } from "@mantine/core";
import Form from "@rjsf/mantine";
import validator from "@rjsf/validator-ajv8";
import type { DescriptionFieldProps } from "@rjsf/utils";

import IsoIntervalWidget from "@/components/IsoIntervalWidget";
import SeaNamesAutocompleteWidget from "@/components/SeaNamesAutocompleteWidget";
import uiSchema from "./uiSchema";
import SpatialCoverageFlatField from "@/components/SpatialCoverageFlatField";
import SpatialCoverageMiniMap from "@/components/SpatialCoverageMiniMap";
import ExternalProjectField from "@/components/ExternalProjectField";
import MainFormCoverageGrid from "@/components/MainFormCoverageGrid";
import CustomArrayFieldItemButtonsTemplate from "@/components/rjsf/CustomButtonsTemplate";
import CustomTitleFieldTemplate from "@/components/rjsf/TitleFieldTemplate";

const NoDescription: React.FC<DescriptionFieldProps> = () => null;

export default function Page() {
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    project_id: "" // Fix controlled/uncontrolled input warning for text input fields
  });

  useEffect(() => {
    fetch("/schema.bundled.json")
      .then((r) => r.json())
      .then(setSchema)
      .catch(console.error);
  }, []);

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
    <Container size="md" py="lg">
      <Stack gap="sm">
        <Title order={2}>OAE Data Protocol – Metadata Builder</Title>
        <Text c="dimmed">
          Fill required fields. Long JSON Schema descriptions are hidden;
          concise tips appear as <code>ui:help</code>.
        </Text>
      </Stack>

      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={(e) => setFormData(e.formData)}
        onSubmit={({ formData }) => console.log("submit:", formData)}
        validator={validator}
        omitExtraData={false}
        liveOmit={false}
        experimental_defaultFormStateBehavior={{
          arrayMinItems: { populate: "all" }
        }}
        widgets={{
          IsoIntervalWidget,
          SeaNamesAutocomplete: SeaNamesAutocompleteWidget
        }}
        templates={{
          DescriptionFieldTemplate: NoDescription,
          ArrayFieldItemButtonsTemplate: CustomArrayFieldItemButtonsTemplate,
          TitleFieldTemplate: CustomTitleFieldTemplate
        }}
        fields={{
          SpatialCoverageFlat: SpatialCoverageFlatField,
          SpatialCoverageMiniMap: SpatialCoverageMiniMap,
          ExternalProjectField: ExternalProjectField,
          MainFormCoverageGrid: MainFormCoverageGrid
        }}
        showErrorList="bottom"
      />

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "4px"
        }}
      >
        <Text style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          JSON Preview:
        </Text>
        <pre
          style={{
            fontSize: "0.8rem",
            overflow: "auto",
            maxHeight: "300px",
            margin: 0
          }}
        >
          {JSON.stringify(formData, null, 2)}
        </pre>
      </div>
    </Container>
  );
}
