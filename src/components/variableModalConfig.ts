/**
 * Configuration for the schema-driven Variable Modal
 *
 * This file defines:
 * - VARIABLE_SCHEMA_MAP: Maps variable_type + genesis + sampling to $defs schema key
 * - VARIABLE_TYPE_OPTIONS: User-facing dropdown options
 * - ACCORDION_CONFIG: Defines accordion sections and their fields
 */

import type { ComponentType } from "react";
import {
  IconInfoCircle,
  IconFlask,
  IconMicroscope,
  IconTool,
  IconAdjustments,
  IconShieldCheck,
  IconFileDescription,
  IconCalculator
} from "@tabler/icons-react";

// Icon type from tabler icons
type IconProps = { size?: number | string; stroke?: number };
type TablerIcon = ComponentType<IconProps>;
// =============================================================================
// Schema Mapping
// =============================================================================

/**
 * Maps the combination of variable_type + genesis + sampling to the correct $defs schema key.
 * Access pattern: VARIABLE_SCHEMA_MAP[variableType][genesis][sampling?]
 *
 * For CALCULATED variables, there's no sampling level - the value is the schema key directly.
 * For MEASURED variables, you need to drill into DISCRETE or CONTINUOUS.
 */
export const VARIABLE_SCHEMA_MAP = {
  pH: {
    MEASURED: {
      DISCRETE: "DiscretePHVariable",
      CONTINUOUS: "ContinuousMeasuredVariable"
    },
    CALCULATED: "CalculatedVariable"
  },
  observed_property: {
    MEASURED: {
      DISCRETE: "DiscreteMeasuredVariable",
      CONTINUOUS: "ContinuousMeasuredVariable"
    },
    CALCULATED: "CalculatedVariable"
  }
} as const;

export type VariableTypeKey = keyof typeof VARIABLE_SCHEMA_MAP;
export type GenesisKey = "MEASURED" | "CALCULATED";
export type SamplingKey = "DISCRETE" | "CONTINUOUS";

/**
 * Normalizes a field entry to a FieldConfig object.
 * Strings are converted to { path: string, span: 12 }
 */
export function normalizeFieldConfig(field: string | FieldConfig): FieldConfig {
  if (typeof field === "string") {
    return { path: field, span: 12, inputType: "text" };
  }
  return {
    path: field.path,
    span: field.span ?? 12,
    inputType: field.inputType ?? "text"
  };
}

// =============================================================================
// Variable Type Options (for dropdown)
// =============================================================================

export const VARIABLE_TYPE_OPTIONS = [
  { value: "pH", label: "pH" },
  { value: "observed_property", label: "Observed Property" }
] as const;

// =============================================================================
// Accordion Configuration
// =============================================================================

export interface FieldConfig {
  path: string;
  /** Grid column span (1-12). Default is 12 (full width) */
  span?: number;
  /** Input type: "text" (single line), "textarea" (multi-line). Default is "text" */
  inputType?: "text" | "textarea";
}

export interface AccordionSection {
  key: string;
  label: string;
  icon: TablerIcon;
  /** Fields can be strings (full width) or FieldConfig objects (with span) */
  fields: (string | FieldConfig)[];
}

/**
 * Defines the accordion sections and which fields appear in each.
 * Fields are specified by their path relative to the variable root.
 * Nested fields use dot notation: "analyzing_instrument.calibration.dye_purified"
 *
 * The component will:
 * 1. For each accordion section, filter fields to only those that exist in the current schema
 * 2. Hide the accordion entirely if no fields are visible
 * 3. Render a SchemaField for each visible field
 */
export const ACCORDION_CONFIG: AccordionSection[] = [
  {
    key: "basic",
    label: "Basic Information",
    icon: IconInfoCircle,
    fields: [
      { path: "long_name", span: 6 },
      { path: "units", span: 6 },
      { path: "dataset_variable_name", span: 6 },
      { path: "dataset_variable_name_qc_flag", span: 6 }
      // "standard_identifier",
      // Note: genesis, sampling, observation_type are handled specially
      // since they drive the schema selection
    ]
  },
  {
    key: "sampling",
    label: "Sampling",
    icon: IconFlask,
    fields: [
      "observation_type",
      "sampling_method",
      { path: "sampling_instrument_type", span: 6 },
      { path: "sampling_instrument_type_custom", span: 6 },
      "field_replicate_information"
    ]
  },
  {
    key: "analysis",
    label: "Analysis",
    icon: IconMicroscope,
    fields: [
      "analyzing_method",
      // pH-specific fields (only exist in DiscretePHVariable)
      { path: "measurement_temperature", span: 6 },
      { path: "ph_reported_temperature", span: 6 },
      "temperature_correction_method",
      // Continuous sensor fields
      "raw_data_calculation_method",
      "calculation_software_version"
    ]
  },
  {
    key: "instrument",
    label: "Analyzing Instrument",
    icon: IconTool,
    fields: [
      { path: "analyzing_instrument.instrument_type", span: 6 },
      { path: "analyzing_instrument.instrument_type_custom", span: 6 },
      { path: "analyzing_instrument.manufacturer", span: 6 },
      { path: "analyzing_instrument.model", span: 6 },
      "analyzing_instrument.serial_number",
      { path: "analyzing_instrument.precision", span: 6 },
      { path: "analyzing_instrument.accuracy", span: 6 }
    ]
  },
  {
    key: "calibration",
    label: "Calibration",
    icon: IconAdjustments,
    fields: [
      // pH-specific calibration (PHCalibration)
      {
        path: "analyzing_instrument.calibration.technique_description",
        span: 6
      },
      {
        path: "analyzing_instrument.calibration.calibration_location",
        span: 6
      },
      "analyzing_instrument.calibration.dye_type_and_manufacturer",
      { path: "analyzing_instrument.calibration.dye_purified", span: 6 },
      {
        path: "analyzing_instrument.calibration.correction_for_unpurified_dye",
        span: 6
      },
      "analyzing_instrument.calibration.dye_correction_method",
      "analyzing_instrument.calibration.ph_of_standards",
      "analyzing_instrument.calibration.calibration_temperature",
      // Generic calibration fields (shared)
      { path: "analyzing_instrument.calibration.frequency", span: 6 },
      "analyzing_instrument.calibration.last_calibration_date",
      "analyzing_instrument.calibration.method_reference",
      "analyzing_instrument.calibration.calibration_certificates"
    ]
  },
  {
    key: "calculation",
    label: "Calculation Details",
    icon: IconCalculator,
    fields: [
      // CalculatedVariable specific
      "calculation_method_and_parameters"
    ]
  },
  {
    key: "qc",
    label: "Quality Control",
    icon: IconShieldCheck,
    fields: [
      "qc_steps_taken",
      { path: "uncertainty", span: 6 },
      { path: "uncertainty_definition", span: 6 },
      { path: "qc_researcher", span: 6 },
      { path: "qc_researcher_institution", span: 6 },
      "appropriate_use_quality"
    ]
  },
  {
    key: "additional",
    label: "Additional Information",
    icon: IconFileDescription,
    fields: [
      "missing_value_indicators",
      "method_reference",
      "measurement_researcher",
      "other_detailed_information"
    ]
  }
];

// =============================================================================
// Helper to get schema key from current form selections
// =============================================================================

/**
 * Determines which $defs schema key to use based on current form selections.
 * Returns null if insufficient information to determine schema.
 */
export function getSchemaKey(
  variableType: string | undefined,
  genesis: string | undefined,
  sampling: string | undefined
): string | null {
  if (!variableType || !genesis) return null;

  const typeMap =
    VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
  if (!typeMap) return null;

  const genesisMap = typeMap[genesis as keyof typeof typeMap];
  if (!genesisMap) return null;

  // CALCULATED doesn't need sampling - it's a direct schema key
  if (typeof genesisMap === "string") {
    return genesisMap;
  }

  // MEASURED needs sampling to determine schema
  if (!sampling) return null;
  return (genesisMap as Record<string, string>)[sampling] || null;
}
