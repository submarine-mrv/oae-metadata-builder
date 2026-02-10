/**
 * Configuration for the schema-driven Variable Modal
 *
 * This file defines:
 * - VARIABLE_SCHEMA_MAP: Maps variable_type + genesis + sampling to $defs schema key
 * - VARIABLE_TYPE_OPTIONS: User-facing dropdown options
 * - getAccordionConfig(): Builds per-type accordion sections from layer stacks
 * - VARIABLE_TYPE_LAYERS: Maps schema keys to their hierarchy layer stacks
 *
 * Field organization uses a hierarchy-aware layer system that mirrors LinkML classes:
 * - Each HierarchyLayer corresponds to a level in the LinkML class tree
 * - buildSectionFields() merges layers using explicit insertion positions
 * - fieldExistsInSchema() handles runtime visibility — layers only organize authoring
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
  },
  co2: {
    MEASURED: {
      DISCRETE: "DiscreteCO2Variable"
    },
    CALCULATED: "CalculatedVariable",
    placeholderOverrides: {
      units: "uatm, ppm, etc."
    }
  },
  hplc: {
    MEASURED: {
      DISCRETE: "HPLCVariable"
    }
  },
  non_measured: {
    DIRECT: "NonMeasuredVariable"
  }
} as const;

export type VariableTypeKey = keyof typeof VARIABLE_SCHEMA_MAP;
export type GenesisKey = "MEASURED" | "CALCULATED";
export type SamplingKey = "DISCRETE" | "CONTINUOUS";

// =============================================================================
// Variable Type Behavior Overrides
// =============================================================================

/**
 * Defines non-standard selection behavior for specific variable types.
 * - fixedGenesis/fixedSampling: auto-set and disable the dropdown
 * - directSchema: skip genesis/sampling entirely (maps via DIRECT key)
 */
export const VARIABLE_TYPE_BEHAVIOR: Record<string, {
  fixedGenesis?: string;
  fixedSampling?: string;
  directSchema?: boolean;
}> = {
  hplc: { fixedGenesis: "MEASURED", fixedSampling: "DISCRETE" },
  non_measured: { directSchema: true },
};

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
  { value: "sediment", label: "Sediment" },
  { value: "co2", label: "CO₂ (xCO₂/pCO₂/fCO₂)" },
  { value: "hplc", label: "HPLC (Pigment Analysis)" },
  { value: "non_measured", label: "Non-Measured Variable" }
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
// Hierarchy-Aware Layer System
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

/** Where to insert a layer's fields relative to existing fields */
type InsertPosition = "append" | "prepend" | { after: string };

/** A layer's contribution to a section: either a plain array (append) or positioned */
type SectionContribution = FieldEntry[] | {
  fields: FieldEntry[];
  position: InsertPosition;
};

/**
 * A hierarchy layer corresponds to one level in the LinkML class tree.
 * Each layer declares which fields it contributes to which accordion sections.
 */
export interface HierarchyLayer {
  name: string;
  sections?: Partial<Record<SectionKey, SectionContribution>>;
}

/** Get the path string from a FieldEntry */
function getFieldPath(entry: FieldEntry): string {
  return typeof entry === "string" ? entry : entry.path;
}

/**
 * Builds the merged field list for a section by applying layers in order.
 *
 * Each layer's contribution is inserted at the specified position:
 * - "append" (default): after all existing fields
 * - "prepend": before all existing fields
 * - { after: "field_path" }: immediately after a specific field
 */
export function buildSectionFields(
  sectionKey: SectionKey,
  layers: HierarchyLayer[]
): FieldEntry[] {
  let result: FieldEntry[] = [];

  for (const layer of layers) {
    const contribution = layer.sections?.[sectionKey];
    if (!contribution) continue;

    // Normalize to { fields, position }
    let fields: FieldEntry[];
    let position: InsertPosition;
    if (Array.isArray(contribution)) {
      fields = contribution;
      position = "append";
    } else {
      fields = contribution.fields;
      position = contribution.position;
    }

    if (fields.length === 0) continue;

    if (position === "append") {
      result = [...result, ...fields];
    } else if (position === "prepend") {
      result = [...fields, ...result];
    } else {
      // { after: "field_path" } — insert immediately after the named field
      const targetPath = position.after;
      const idx = result.findIndex((f) => getFieldPath(f) === targetPath);
      if (idx === -1) {
        // Target not found — append as fallback
        result = [...result, ...fields];
      } else {
        result = [
          ...result.slice(0, idx + 1),
          ...fields,
          ...result.slice(idx + 1)
        ];
      }
    }
  }

  return result;
}

// =============================================================================
// Layer Definitions (mirror LinkML class hierarchy)
// =============================================================================

/** BaseVariable + Variable + ObservedPropertyVariable + QCFields */
const BASE: HierarchyLayer = {
  name: "BaseVariable",
  sections: {
    basic: [
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
    ],
    sampling: [
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
    analysis: [
      {
        path: "analyzing_method",
        placeholderText: "Describe the analysis method used"
      }
    ],
    instrument: [
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
    ],
    qc: [
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
    ],
    additional: [
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
    ]
  }
};

/** DiscreteMeasuredVariable — shared calibration fields (top + bottom) */
const DISCRETE: HierarchyLayer = {
  name: "DiscreteMeasuredVariable",
  sections: {
    calibration: [
      {
        path: "analyzing_instrument.calibration.technique_description",
        span: 6,
        placeholderText: "Details of the calibration technique"
      },
      {
        path: "analyzing_instrument.calibration.calibration_location",
        span: 6
      },
      // Bottom fields (frequency, last_calibration_date, etc.) follow type-specific inserts
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
    ]
  }
};

/** ContinuousMeasuredVariable */
const CONTINUOUS: HierarchyLayer = {
  name: "ContinuousMeasuredVariable",
  sections: {
    analysis: ["raw_data_calculation_method", "calculation_software_version"]
  }
};

/** CalculatedVariable */
const CALCULATED: HierarchyLayer = {
  name: "CalculatedVariable",
  sections: {
    calculation: [
      {
        path: "calculation_method_and_parameters",
        placeholderText:
          "e.g., Using CO2SYS with Lueker et al. (2000) constants"
      }
    ]
  }
};

/** MeasuredSedimentFields ∪ DiscreteSedimentVariable */
const SEDIMENT: HierarchyLayer = {
  name: "SedimentVariable",
  sections: {
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
  }
};

/** MeasuredTA/DICFields ∪ DiscreteTA/DICVariable */
const TA_DIC: HierarchyLayer = {
  name: "TA_DICVariable",
  sections: {
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
    calibration: {
      fields: [
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
      ],
      position: { after: "analyzing_instrument.calibration.calibration_location" }
    }
  }
};

/** MeasuredPHFields ∪ DiscretePHVariable ∪ ContinuousPHVariable */
const PH: HierarchyLayer = {
  name: "PHVariable",
  sections: {
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
    calibration: {
      fields: [
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
      ],
      position: { after: "analyzing_instrument.calibration.calibration_location" }
    }
  }
};

/** MeasuredCO2Fields ∪ DiscreteCO2Variable */
const CO2: HierarchyLayer = {
  name: "CO2Variable",
  sections: {
    sampling: [
      {
        path: "storage_method",
        placeholderText: "How samples were stored before measurement"
      }
    ],
    analysis: [
      {
        path: "headspace_volume",
        span: 6,
        placeholderText: "Volume of headspace (mL)"
      },
      {
        path: "seawater_volume",
        span: 6,
        placeholderText: "Volume of seawater in flask (mL)"
      },
      {
        path: "water_vapor_correction_method",
        placeholderText: "How water vapor pressure was determined"
      }
    ],
    instrument: [
      {
        path: "analyzing_instrument.detector_type",
        span: 6,
        placeholderText: "Type of CO2 gas detector"
      },
      {
        path: "analyzing_instrument.resolution",
        span: 6,
        placeholderText: "Sensor resolution"
      },
      {
        path: "analyzing_instrument.uncertainty",
        span: 6,
        placeholderText: "Sensor uncertainty"
      }
    ],
    calibration: {
      fields: [
        {
          path: "analyzing_instrument.calibration.standard_gas_info.manufacturer",
          span: 6,
          placeholderText: "Standard gas manufacturer"
        },
        {
          path: "analyzing_instrument.calibration.standard_gas_info.concentration",
          span: 6,
          placeholderText: "e.g., 260, 350, 510 ppm"
        },
        {
          path: "analyzing_instrument.calibration.standard_gas_info.uncertainty",
          span: 6,
          placeholderText: "e.g., 0.5%"
        },
        {
          path: "analyzing_instrument.calibration.calibration_temperature",
          span: 6,
          placeholderText: "Temperature of calibration"
        }
      ],
      position: { after: "analyzing_instrument.calibration.calibration_location" }
    }
  }
};

/** HPLCVariable */
const HPLC: HierarchyLayer = {
  name: "HPLCVariable",
  sections: {
    analysis: [
      { path: "hplc_lab", span: 6, placeholderText: "e.g., NASA_GSFC" },
      { path: "hplc_lab_technician", span: 6, placeholderText: "Name and contact info" },
    ],
  }
};

// =============================================================================
// Variable Type Layer Stacks
// =============================================================================

/**
 * Maps each schema key to its hierarchy layer stack.
 * The layers are applied in order to build the field list for each section.
 */
export const VARIABLE_TYPE_LAYERS: Record<string, HierarchyLayer[]> = {
  // Discrete
  DiscretePHVariable:       [BASE, DISCRETE, PH],
  DiscreteTAVariable:       [BASE, DISCRETE, TA_DIC],
  DiscreteDICVariable:      [BASE, DISCRETE, TA_DIC],
  DiscreteSedimentVariable: [BASE, DISCRETE, SEDIMENT],
  DiscreteCO2Variable:      [BASE, DISCRETE, CO2],
  HPLCVariable:             [BASE, DISCRETE, HPLC],
  DiscreteMeasuredVariable: [BASE, DISCRETE],
  // Continuous
  ContinuousPHVariable:       [BASE, CONTINUOUS, PH],
  ContinuousTAVariable:       [BASE, CONTINUOUS, TA_DIC],
  ContinuousDICVariable:      [BASE, CONTINUOUS, TA_DIC],
  ContinuousSedimentVariable: [BASE, CONTINUOUS, SEDIMENT],
  ContinuousMeasuredVariable: [BASE, CONTINUOUS],
  // Other
  CalculatedVariable:  [BASE, CALCULATED],
  NonMeasuredVariable: [BASE],
};

// =============================================================================
// Accordion Section Definitions + ACCORDION_CONFIG Builder
// =============================================================================

interface AccordionSectionDef {
  key: SectionKey;
  label: string;
  icon: TablerIcon;
}

export const ACCORDION_SECTIONS: AccordionSectionDef[] = [
  { key: "basic", label: "Basic Information", icon: IconInfoCircle },
  { key: "sampling", label: "Sampling", icon: IconFlask },
  { key: "analysis", label: "Analysis", icon: IconMicroscope },
  { key: "instrument", label: "Analyzing Instrument", icon: IconTool },
  { key: "calibration", label: "Calibration", icon: IconAdjustments },
  { key: "calculation", label: "Calculation Details", icon: IconCalculator },
  { key: "qc", label: "Quality Control", icon: IconShieldCheck },
  { key: "additional", label: "Additional Information", icon: IconFileDescription }
];

/**
 * Returns the accordion config for a specific variable type's schema key.
 * Builds sections from the type's layer stack, returning only sections that have fields.
 * Returns empty array for unknown schema keys.
 */
export function getAccordionConfig(schemaKey: string): AccordionSection[] {
  const layers = VARIABLE_TYPE_LAYERS[schemaKey];
  if (!layers) return [];

  return ACCORDION_SECTIONS
    .map((s) => ({
      ...s,
      fields: buildSectionFields(s.key, layers),
    }))
    .filter((s) => s.fields.length > 0);
}

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
  if (!variableType) return null;

  const typeMap =
    VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
  if (!typeMap) return null;

  // DIRECT types skip genesis/sampling entirely (DIRECT is mutually exclusive with MEASURED/CALCULATED)
  if ("DIRECT" in typeMap && !genesis) {
    return (typeMap as Record<string, unknown>).DIRECT as string;
  }

  if (!genesis) return null;

  const genesisMap = (typeMap as Record<string, unknown>)[genesis];
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
