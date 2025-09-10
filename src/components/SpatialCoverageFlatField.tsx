"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { TextInput, Text } from "@mantine/core";

// parse "W S E N" string from nested object
function readBox(formData: any): string {
  // schema path: spatial_coverage -> Place -> { geo: GeoShape | null } -> { box: string | null }
  const v = formData?.geo?.box;
  return typeof v === "string" ? v : "";
}

// write nested object from "W S E N" string
function writeBox(s: string): any {
  const trimmed = s.trim();
  if (!trimmed) return null; // satisfies anyOf null
  return { geo: { box: trimmed } }; // minimal Place->GeoShape structure that satisfies the schema
}

const SpatialCoverageFlatField: React.FC<FieldProps> = (props) => {
  const {
    idSchema,
    formData,
    onChange,
    disabled,
    readonly,
    required,
    schema,
    uiSchema
  } = props;

  // This field completely replaces any default object/anyOf rendering

  const id = idSchema.$id;
  const [value, setValue] = React.useState<string>(readBox(formData));

  React.useEffect(() => {
    const boxValue = readBox(formData);
    setValue(boxValue);
  }, [formData]);

  const label =
    uiSchema?.["ui:title"] ??
    schema?.title ??
    "Spatial coverage (bounding box)";

  const placeholder =
    uiSchema?.["ui:options"]?.placeholder ??
    "W S E N  (lon/lat, decimal degrees)";

  const maxWidth = uiSchema?.["ui:options"]?.maxWidth ?? 420;

  // Return only our custom component, not any default children
  return (
    <>
      <div style={{ maxWidth }}>
        <label style={{ fontWeight: 600 }}>
          {label}
          {required ? " *" : ""}
        </label>

        <TextInput
          id={id}
          value={value}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setValue(next);
            const newData = writeBox(next);
            onChange(newData);
          }}
          onBlur={(e) => {
            // optional: normalize spaces on blur
            const norm = e.currentTarget.value.trim().replace(/\s+/g, " ");
            setValue(norm);
            onChange(writeBox(norm));
          }}
          placeholder={placeholder}
          disabled={disabled || readonly}
          styles={{
            input: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
            }
          }}
        />

        <Text size="xs" c="dimmed" mt={4}>
          Enter four numbers: <code>W S E N</code> (longitude/latitude; e.g.
          <code> -124.5 36.8 -121.9 38.2</code>). Leave blank to set{" "}
          <code>null</code>.
        </Text>
      </div>
    </>
  );
};

export default SpatialCoverageFlatField;
