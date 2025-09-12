"use client";

import React from "react";
import type { FieldProps } from "@rjsf/utils";
import { TextInput, Text, Tooltip, ActionIcon, Box } from "@mantine/core";
import { IconMap } from "@tabler/icons-react";
import MapBoundingBoxSelectorProper from "./MapBoundingBoxSelectorProper";

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

// validate spatial bounds according to WKT conventions
function validateSpatialBounds(boxString: string): string | null {
  const trimmed = boxString.trim();
  if (!trimmed) return null; // empty is valid (null)

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 4) {
    return "Must contain exactly 4 numbers: W S E N";
  }

  const [west, south, east, north] = parts.map(Number);

  // Check if all parts are valid numbers
  if (
    parts.some((part, i) => !Number.isFinite([west, south, east, north][i]))
  ) {
    return "All values must be valid numbers";
  }

  // WKT longitude bounds: -180 to 180
  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return "Longitude (W, E) must be between -180 and 180";
  }

  // WKT latitude bounds: -90 to 90
  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return "Latitude (S, N) must be between -90 and 90";
  }

  // Logical bounds check
  if (east <= west) {
    return "East longitude must be greater than West longitude";
  }

  if (north <= south) {
    return "North latitude must be greater than South latitude";
  }

  return null; // valid
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
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const [showMap, setShowMap] = React.useState(false);

  React.useEffect(() => {
    const boxValue = readBox(formData);
    setValue(boxValue);
    setValidationError(validateSpatialBounds(boxValue));
  }, [formData]);

  const label =
    uiSchema?.["ui:title"] ??
    schema?.title ??
    "Spatial coverage (bounding box)";

  const placeholder =
    uiSchema?.["ui:options"]?.placeholder ??
    "W S E N  (lon/lat, decimal degrees)";

  const maxWidth = uiSchema?.["ui:options"]?.maxWidth ?? 420;

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    const error = validateSpatialBounds(newValue);
    setValidationError(error);
    const newData = writeBox(newValue);
    onChange(newData);
  };

  // Return only our custom component, not any default children
  return (
    <>
      <div style={{ maxWidth }}>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px"
          }}
        >
          <label style={{ fontWeight: 600 }}>
            {label}
            {required ? " *" : ""}
          </label>
          <Tooltip label="Click to open map for bounding box selection">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setShowMap(true)}
              style={{ cursor: "pointer" }}
            >
              <IconMap size={16} />
            </ActionIcon>
          </Tooltip>
        </Box>

        <TextInput
          id={id}
          value={value}
          onChange={(e) => {
            const next = e.currentTarget.value;
            handleValueChange(next);
          }}
          onBlur={(e) => {
            // optional: normalize spaces on blur
            const norm = e.currentTarget.value.trim().replace(/\s+/g, " ");
            handleValueChange(norm);
          }}
          placeholder={placeholder}
          disabled={disabled || readonly}
          error={validationError}
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

      <MapBoundingBoxSelectorProper
        opened={showMap}
        onClose={() => setShowMap(false)}
        onSelect={(bounds) => {
          handleValueChange(bounds);
          setShowMap(false);
        }}
        initialBounds={value}
      />
    </>
  );
};

export default SpatialCoverageFlatField;
