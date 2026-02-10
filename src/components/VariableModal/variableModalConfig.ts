/**
 * Configuration for the schema-driven Variable Modal
 *
 * This file defines:
 * - VARIABLE_SCHEMA_MAP: Maps variable_type + genesis + sampling to $defs schema key
 * - VARIABLE_TYPE_OPTIONS: User-facing dropdown options
 * - ACCORDION_CONFIG: Defines accordion sections and their fields
 *
 * Field organization:
 * - Base/shared fields are defined inline in ACCORDION_CONFIG
 * - Type-specific fields are defined in named groups (phFields, taDicFields, etc.)
 * - collectFields() merges base + type-specific fields per section
 * - fieldExistsInSchema() handles runtime visibility — groups only organize authoring
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
      CONTINUOUS: "ContinuousPHVariable"
    },
    CALCULATED: "CalculatedVariable",
    placeholderOverrides: {
      units: "NBS scale, total scale, seawater scale, etc."
    }
  },
  observed_property: {
    MEASURED: {
      DISCRETE: "DiscreteMeasuredVariable",
      CONTINUOUS: "ContinuousMeasuredVariable"
    },
    CALCULATED: "CalculatedVariable"
  },
  ta: {
    MEASURED: {
      DISCRETE: "DiscreteTAVariable",
      CONTINUOUS: "ContinuousTAVariable"
    },
    CALCULATED: "CalculatedVariable"
  },
  dic: {
    MEASURED: {
      DISCRETE: "DiscreteDICVariable",
      CONTINUOUS: "ContinuousDICVariable"
    },
    CALCULATED: "CalculatedVariable"
  },
  sediment: {
    MEASURED: {
      DISCRETE: "DiscreteSedimentVariable",
      CONTINUOUS: "ContinuousSedimentVariable"
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
    return {
      path: field,
      span: 12,
      inputType: "text",
      descriptionModal: false,
      placeholderText: undefined,
      rows: undefined,
      gateLabel: undefined,
      newRowAfter: false
    };
  }
  return {
    path: field.path,
    span: field.span ?? 12,
    inputType: field.inputType ?? "text",
    descriptionModal: field.descriptionModal ?? false,
    placeholderText: field.placeholderText,
    rows: field.rows,
    gateLabel: field.gateLabel,
    newRowAfter: field.newRowAfter ?? false
  };
}

// =============================================================================
// Variable Type Options (for dropdown)
// =============================================================================

export const VARIABLE_TYPE_OPTIONS = [
  { value: "pH", label: "pH" },
  { value: "ta", label: "Total Alkalinity (TA)" },
  { value: "dic", label: "Dissolved Inorganic Carbon (DIC)" },
  { value: "observed_property", label: "Observed Property" },
  { value: "sediment", label: "Sediment" }
] as const;

// =============================================================================
// Accordion Configuration
// =============================================================================

export interface FieldConfig {
  path: string;
  /** Grid column span (1-12). Default is 12 (full width) */
  span?: number;
  /**
   * Input type:
   * - "text" (single line) - default
   * - "textarea" (multi-line)
   * - "enum_with_other" - enum dropdown with auto-shown custom field when "other" selected
   * - "boolean_select" - renders boolean as Yes/No dropdown instead of checkbox
   * - "optional_with_gate" - Yes/No gate question that shows text input when "Yes" selected
   */
  inputType?:
    | "text"
    | "textarea"
    | "enum_with_other"
    | "boolean_select"
    | "optional_with_gate";
  /** Show description in a modal popup instead of tooltip. Default is false (tooltip) */
  descriptionModal?: boolean;
  /** Placeholder text for the input field */
  placeholderText?: string;
  /** Number of rows for textarea inputs. Default is 2-6 (autosize) */
  rows?: number;
  /** Label for the Yes/No gate question (used with optional_with_gate) */
  gateLabel?: string;
  /** Force a new row after this field (fills remaining space with empty col) */
  newRowAfter?: boolean;
}

export interface AccordionSection {
  key: string;
  label: string;
  icon: TablerIcon;
  /** Fields can be strings (full width) or FieldConfig objects (with span) */
  fields: (string | FieldConfig)[];
}

// =============================================================================
// Trait-Based Field Groups
// =============================================================================

/** Valid accordion section keys */
type SectionKey =
  | "basic"
  | "sampling"
  | "analysis"
  | "instrument"
  | "calibration"
  | "calculation"
  | "qc"
  | "additional";

type FieldEntry = string | FieldConfig;

/** Maps section keys to field entries that should appear in that section */
type SectionFields = Partial<Record<SectionKey, FieldEntry[]>>;

/** pH-specific fields (DiscretePHVariable, ContinuousPHVariable) */
const phFields: SectionFields = {
  analysis: [
    {
      path: "measurement_temperature",
      span: 6,
      placeholderText: "Temperature at which pH was measured"
    },
    {
      path: "ph_reported_temperature",
      span: 6,
      placeholderText: "Temperature at which pH is reported"
    },
    {
      path: "temperature_correction_method",
      placeholderText: "Method used to correct pH for temperature"
    }
  ],
  calibration: [
    {
      path: "analyzing_instrument.calibration.dye_type_and_manufacturer",
      placeholderText: "e.g., m-cresol purple from Sigma-Aldrich"
    },
    {
      path: "analyzing_instrument.calibration.dye_purified",
      span: 6,
      inputType: "boolean_select"
    },
    {
      path: "analyzing_instrument.calibration.correction_for_unpurified_dye",
      span: 6,
      placeholderText: "Correction method applied"
    },
    {
      path: "analyzing_instrument.calibration.dye_correction_method",
      placeholderText: "Method used to correct for dye effects"
    },
    {
      path: "analyzing_instrument.calibration.ph_of_standards",
      span: 6,
      placeholderText: "pH values of calibration standards"
    },
    {
      path: "analyzing_instrument.calibration.calibration_temperature",
      span: 6,
      placeholderText: "Temperature of calibration"
    }
  ]
};

/** TA/DIC shared fields */
const taDicFields: SectionFields = {
  sampling: [
    {
      path: "sample_preservation.preservative",
      span: 6,
      placeholderText: "e.g., Mercury Chloride"
    },
    {
      path: "sample_preservation.volume",
      span: 6,
      placeholderText: "Volume of preservative used"
    },
    {
      path: "sample_preservation.correction_description",
      placeholderText: "How the preservative effect was corrected for"
    }
  ],
  analysis: [
    {
      path: "titration_type",
      span: 6,
      placeholderText: "Type of titration used"
    },
    {
      path: "titration_cell_type",
      span: 6
    },
    {
      path: "curve_fitting_method",
      span: 6,
      placeholderText: "Curve fitting method for alkalinity"
    },
    {
      path: "blank_correction",
      placeholderText: "Whether and how results were corrected for blank"
    }
  ],
  calibration: [
    {
      path: "analyzing_instrument.calibration.crm_manufacturer",
      span: 6,
      placeholderText: "e.g., Scripps, JAMSTEC"
    },
    {
      path: "analyzing_instrument.calibration.crm_batch_number",
      span: 6,
      placeholderText: "CRM batch number"
    }
  ]
};

/** Sediment-specific fields */
const sedimentFields: SectionFields = {
  sampling: [
    {
      path: "sediment_type",
      span: 6,
      placeholderText: "e.g., mud, sand"
    },
    {
      path: "sediment_sampling_method",
      span: 6,
      placeholderText: "e.g., sediment core, grab sampling, dredging"
    },
    {
      path: "sediment_sampling_depth",
      span: 6,
      placeholderText: "Depth below sediment surface"
    },
    {
      path: "sediment_sampling_water_depth",
      span: 6,
      placeholderText: "Water depth where sediment was collected"
    }
  ]
};

/** Continuous sensor fields (shared across all continuous types) */
const continuousFields: SectionFields = {
  analysis: ["raw_data_calculation_method", "calculation_software_version"]
};

/** Calculated variable fields */
const calculatedFields: SectionFields = {
  calculation: [
    {
      path: "calculation_method_and_parameters",
      placeholderText:
        "e.g., Using CO2SYS with Lueker et al. (2000) constants"
    }
  ]
};

/**
 * Merges base fields with entries from any number of field groups for a given section.
 * Group entries are appended after base fields.
 */
function collectFields(
  sectionKey: SectionKey,
  baseFields: FieldEntry[],
  ...groups: SectionFields[]
): FieldEntry[] {
  const result = [...baseFields];
  for (const group of groups) {
    const extra = group[sectionKey];
    if (extra) result.push(...extra);
  }
  return result;
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
 *
 * Type-specific fields are organized in named groups above and merged via collectFields().
 * All groups are included — fieldExistsInSchema() handles runtime visibility.
 */
export const ACCORDION_CONFIG: AccordionSection[] = [
  {
    key: "basic",
    label: "Basic Information",
    icon: IconInfoCircle,
    fields: collectFields(
      "basic",
      [
        { path: "long_name", span: 6, placeholderText: "Full descriptive name" },
        {
          path: "units",
          span: 6,
          placeholderText: "e.g., umol/kg, dimensionless"
        },
        {
          path: "dataset_variable_name",
          span: 6,
          placeholderText: "e.g., pH_total, DIC, TA",
          newRowAfter: true
        },
        {
          path: "concentration_basis",
          span: 6
        },
        {
          path: "dataset_variable_name_qc_flag",
          inputType: "optional_with_gate",
          gateLabel: "Quality flag is included as a separate column",
          placeholderText: "e.g., pH_flag"
        },
        {
          path: "dataset_variable_name_raw",
          inputType: "optional_with_gate",
          gateLabel: "Raw data is included as a separate column",
          placeholderText: "e.g., pH_raw"
        }
      ]
    )
  },
  {
    key: "sampling",
    label: "Sampling",
    icon: IconFlask,
    fields: collectFields(
      "sampling",
      [
        "observation_type",
        {
          path: "sampling_method",
          placeholderText: "Describe how samples were collected"
        },
        {
          path: "sampling_instrument_type",
          span: 6,
          inputType: "enum_with_other"
        },
        {
          path: "field_replicate_information",
          placeholderText: "e.g., triplicate samples"
        }
      ],
      sedimentFields,
      taDicFields
    )
  },
  {
    key: "analysis",
    label: "Analysis",
    icon: IconMicroscope,
    fields: collectFields(
      "analysis",
      [
        {
          path: "analyzing_method",
          placeholderText: "Describe the analysis method used"
        }
      ],
      phFields,
      taDicFields,
      continuousFields
    )
  },
  {
    key: "instrument",
    label: "Analyzing Instrument",
    icon: IconTool,
    fields: collectFields("instrument", [
      {
        path: "analyzing_instrument.instrument_type",
        span: 6,
        inputType: "enum_with_other"
      },
      {
        path: "analyzing_instrument.manufacturer",
        span: 6,
        placeholderText: "e.g., Agilent"
      },
      {
        path: "analyzing_instrument.model",
        span: 6,
        placeholderText: "Model number"
      },
      {
        path: "analyzing_instrument.serial_number",
        span: 6,
        placeholderText: "Instrument serial number"
      },
      {
        path: "analyzing_instrument.precision",
        span: 6,
        placeholderText: "Instrument precision"
      },
      {
        path: "analyzing_instrument.accuracy",
        span: 6,
        placeholderText: "Instrument accuracy"
      }
    ])
  },
  {
    key: "calibration",
    label: "Calibration",
    icon: IconAdjustments,
    fields: collectFields(
      "calibration",
      [
        {
          path: "analyzing_instrument.calibration.technique_description",
          span: 6,
          placeholderText: "Details of the calibration technique"
        },
        {
          path: "analyzing_instrument.calibration.calibration_location",
          span: 6
        },
        {
          path: "analyzing_instrument.calibration.frequency",
          span: 6,
          placeholderText: "How often calibrated"
        },
        {
          path: "analyzing_instrument.calibration.last_calibration_date",
          span: 6,
          placeholderText: "YYYY-MM-DD"
        },
        {
          path: "analyzing_instrument.calibration.method_reference",
          placeholderText: "Citation for calibration method"
        },
        "analyzing_instrument.calibration.calibration_certificates"
      ],
      taDicFields,
      phFields
    )
  },
  {
    key: "calculation",
    label: "Calculation Details",
    icon: IconCalculator,
    fields: collectFields("calculation", [], calculatedFields)
  },
  {
    key: "qc",
    label: "Quality Control",
    icon: IconShieldCheck,
    fields: collectFields("qc", [
      {
        path: "qc_steps_taken",
        inputType: "textarea",
        placeholderText:
          "If quality control procedures are described in a separate document uploaded with the data, provide the name of the document here."
      },
      { path: "uncertainty", span: 6, placeholderText: "e.g., ±0.01 pH units" },
      {
        path: "uncertainty_definition",
        span: 6,
        placeholderText: "Description of uncertainty calculation"
      },
      { path: "qc_researcher", span: 6 },
      {
        path: "qc_researcher_institution",
        span: 6,
        placeholderText: "Institution name"
      }
    ])
  },
  {
    key: "additional",
    label: "Additional Information",
    icon: IconFileDescription,
    fields: collectFields("additional", [
      {
        path: "missing_value_indicators",
        span: 6,
        placeholderText: "e.g., -999, NaN, NA"
      },
      { path: "appropriate_use_quality", span: 6, descriptionModal: true },
      {
        path: "method_reference",
        placeholderText: "Citation for the method used"
      },
      "measurement_researcher",
      {
        path: "other_detailed_information",
        inputType: "textarea",
        placeholderText: "Any additional information about this variable"
      }
    ])
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

/**
 * Gets a placeholder override for a specific field based on variable type.
 * Returns undefined if no override exists (use config default).
 */
export function getPlaceholderOverride(
  variableType: string | undefined,
  fieldPath: string
): string | undefined {
  if (!variableType) return undefined;
  const typeConfig =
    VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
  if (!typeConfig || !("placeholderOverrides" in typeConfig)) return undefined;
  const overrides = typeConfig.placeholderOverrides as
    | Record<string, string>
    | undefined;
  return overrides?.[fieldPath];
}
