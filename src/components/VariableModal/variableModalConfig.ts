/**
 * Configuration for the schema-driven Variable Modal
 *
 * This file defines:
 * - VARIABLE_SCHEMA_MAP: Maps variable_type + genesis + sampling to $defs schema key
 * - VARIABLE_TYPE_OPTIONS: User-facing dropdown options
 * - getAccordionConfig(): Builds per-type accordion sections from layer stacks
 * - VARIABLE_TYPE_LAYERS: Maps schema keys to their hierarchy layer stacks
 * - normalizeVariableFields(): Fixes inconsistencies on import/load (also used by exportImport.ts)
 * - stripExtraVariableFields(): AJV-based schema-driven field stripping (also used by exportImport.ts, datasetValidation.ts)
 *
 * Note: normalizeVariableFields and stripExtraVariableFields are shared utilities used
 * beyond the modal — by the import pipeline and dataset validator. A future refactor
 * could move them to src/utils/variableUtils.ts once variable TypeScript types exist.
 *
 * Field organization uses a hierarchy-aware layer system that mirrors LinkML classes:
 * - Each HierarchyLayer corresponds to a level in the LinkML class tree
 * - buildSectionFields() merges layers using explicit insertion positions
 * - fieldExistsInSchema() handles runtime visibility — layers only organize authoring
 *
 * ## When to update this file after schema changes
 *
 * When a variable class is added/removed/renamed in LinkML (variable.yaml):
 * 1. VARIABLE_SCHEMA_MAP — add/update the mapping from variable_type + genesis
 *    + sampling to the new $defs class name. String value = direct mapping (no
 *    genesis/sampling), object = drill into genesis → sampling.
 * 2. VARIABLE_TYPE_OPTIONS — add a user-facing label if a new variable_type was added.
 * 3. VARIABLE_TYPE_LAYERS — add a layer stack for the new class so the accordion
 *    config knows which fields to show and in which sections.
 * 4. normalizeVariableFields() — update only if:
 *    - A new "shared" class is added (like CalculatedVariable, used by multiple
 *      variable_types). The shared-class branch needs to know about it.
 *    - The valid set of variable_types that support calculated changes.
 *    The function derives its lookup (SCHEMA_CLASS_LOOKUP) from VARIABLE_SCHEMA_MAP
 *    automatically, so simple additions don't require changes here.
 *
 * Long-term, VARIABLE_SCHEMA_MAP should be derived from JSON Schema $defs at build
 * time rather than maintained by hand. See oae-data-commons#93.
 */

import {
  IconAdjustments,
  IconCalculator,
  IconCloud,
  IconDroplet,
  IconFileDescription,
  IconFlask,
  IconGauge,
  IconInfoCircle,
  IconLeaf,
  IconMicroscope,
  IconShieldCheck,
  IconTemperature,
  IconTool,
  IconUsers,
  IconWind,
} from "@tabler/icons-react";
import Ajv2019 from "ajv/dist/2019";
import type { ComponentType } from "react";
import type { JSONSchema } from "@/components/schemaUtils";

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
    measured: {
      discrete: "DiscretePHVariable",
      continuous: "ContinuousPHVariable",
    },
    calculated: "CalculatedVariable",
    placeholderOverrides: {
      units: "NBS scale, total scale, seawater scale, etc.",
    },
  },
  other: {
    measured: {
      discrete: "DiscreteMeasuredVariable",
      continuous: "ContinuousMeasuredVariable",
    },
    calculated: "CalculatedVariable",
  },
  ta: {
    measured: {
      discrete: "DiscreteTAVariable",
      continuous: "ContinuousTAVariable",
    },
    calculated: "CalculatedVariable",
  },
  dic: {
    measured: {
      discrete: "DiscreteDICVariable",
      continuous: "ContinuousDICVariable",
    },
    calculated: "CalculatedVariable",
  },
  sediment: {
    measured: {
      discrete: "DiscreteSedimentVariable",
      continuous: "ContinuousSedimentVariable",
    },
    calculated: "CalculatedVariable",
  },
  co2: {
    measured: {
      discrete: "DiscreteCO2Variable",
      continuous: "ContinuousCO2Variable",
    },
    calculated: "CalculatedVariable",
    placeholderOverrides: {
      units: "uatm, ppm, etc.",
    },
  },
  hplc: {
    measured: {
      discrete: "HPLCVariable",
    },
  },
  physiological: {
    measured: {
      discrete: "DiscretePhysiologicalVariable",
      continuous: "ContinuousPhysiologicalVariable",
    },
    calculated: "CalculatedVariable",
  },
  // String value = direct mapping (no genesis/sampling sub-levels)
  socioeconomic: "SocioeconomicVariable",
  non_measured: "NonMeasuredVariable",
} as const;

export type VariableTypeKey = keyof typeof VARIABLE_SCHEMA_MAP;
export type GenesisKey = "measured" | "calculated";
export type SamplingKey = "discrete" | "continuous";

// =============================================================================
// Variable Type Behavior Overrides
// =============================================================================

/**
 * Defines non-standard selection behavior for specific variable types.
 * - fixedGenesis/fixedSampling: auto-set in handleVariableTypeChange, hide the dropdown
 * - directSchema: skip genesis/sampling entirely (string value in VARIABLE_SCHEMA_MAP)
 */
export const VARIABLE_TYPE_BEHAVIOR: Record<
  string,
  {
    fixedGenesis?: string;
    fixedSampling?: string;
    directSchema?: boolean;
  }
> = {
  hplc: { fixedGenesis: "measured", fixedSampling: "discrete" },
  socioeconomic: { directSchema: true },
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
      newRowAfter: false,
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
    newRowAfter: field.newRowAfter ?? false,
  };
}

// =============================================================================
// Variable Type Options (for dropdown)
// =============================================================================

export const VARIABLE_TYPE_OPTIONS = [
  { value: "other", label: "Generic Variable" },
  { value: "pH", label: "pH" },
  { value: "ta", label: "Total Alkalinity (TA)" },
  { value: "dic", label: "Dissolved Inorganic Carbon (DIC)" },
  { value: "sediment", label: "Sediment" },
  { value: "co2", label: "xCO₂/pCO₂/fCO₂" },
  { value: "hplc", label: "HPLC" },
  { value: "physiological", label: "Physiological Response" },
  { value: "socioeconomic", label: "Socioeconomic" },
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
  inputType?: "text" | "textarea" | "enum_with_other" | "boolean_select" | "optional_with_gate";
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
  | "biological"
  | "calculation"
  | "study_details"
  | "qc"
  | "additional"
  | "equilibrator"
  | "equilibrator_temp_sensor"
  | "equilibrator_pressure_sensor"
  | "atmospheric_pressure_sensor"
  | "marine_air";

type FieldEntry = string | FieldConfig;

/** Where to insert a layer's fields relative to existing fields */
type InsertPosition = "append" | "prepend" | { after: string };

/** A layer's contribution to a section: either a plain array (append) or positioned */
type SectionContribution =
  | FieldEntry[]
  | {
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
 *
 * Note on `{ after }` semantics: each insert searches for the original anchor,
 * not previously inserted fields. When multiple layers target the same anchor,
 * later layers end up closer to the anchor (reversed relative to layer order).
 * For example, layers [L1, L2] both inserting after "anchor" produce:
 *   anchor → L2_fields → L1_fields
 * This is accounted for in VARIABLE_TYPE_LAYERS ordering.
 */
export function buildSectionFields(sectionKey: SectionKey, layers: HierarchyLayer[]): FieldEntry[] {
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
        result = [...result.slice(0, idx + 1), ...fields, ...result.slice(idx + 1)];
      }
    }
  }

  return result;
}

// =============================================================================
// Layer Definitions (mirror LinkML class hierarchy)
// =============================================================================

/** Variable + InSituVariable + MeasuredVariable + QCFields */
const BASE: HierarchyLayer = {
  name: "Variable",
  sections: {
    basic: [
      { path: "long_name", span: 6, placeholderText: "Full descriptive name" },
      {
        path: "units",
        span: 6,
        placeholderText: "e.g., umol/kg, dimensionless",
      },
      {
        path: "dataset_variable_name",
        span: 6,
        placeholderText: "e.g., pH_total, DIC, TA",
        newRowAfter: true,
      },
      {
        path: "concentration_basis",
        span: 6,
      },
      {
        path: "dataset_variable_name_qc_flag",
        inputType: "optional_with_gate",
        gateLabel: "Quality flag is included as a separate column",
        placeholderText: "e.g., pH_flag",
      },
      {
        path: "dataset_variable_name_raw",
        inputType: "optional_with_gate",
        gateLabel: "Raw data is included as a separate column",
        placeholderText: "e.g., pH_raw",
      },
    ],
    sampling: [
      "observation_type",
      {
        path: "sampling_method",
        placeholderText: "Describe how samples were collected",
      },
      {
        path: "sampling_instrument_type",
        span: 6,
        inputType: "enum_with_other",
      },
      {
        path: "field_replicate_information",
        placeholderText: "e.g., triplicate samples",
      },
    ],
    analysis: [
      {
        path: "analyzing_method",
        placeholderText: "Describe the analysis method used",
      },
    ],
    instrument: [
      {
        path: "analyzing_instrument.instrument_type",
        span: 6,
        inputType: "enum_with_other",
      },
      {
        path: "analyzing_instrument.manufacturer",
        span: 6,
        placeholderText: "e.g., Agilent",
      },
      {
        path: "analyzing_instrument.model",
        span: 6,
        placeholderText: "Model number",
      },
      {
        path: "analyzing_instrument.serial_number",
        span: 6,
        placeholderText: "Instrument serial number",
      },
      {
        path: "analyzing_instrument.precision",
        span: 6,
        placeholderText: "Instrument precision",
      },
      {
        path: "analyzing_instrument.accuracy",
        span: 6,
        placeholderText: "Instrument accuracy",
      },
    ],
    // Shared calibration fields from the base Calibration class, inherited by
    // every measured variable's analyzing_instrument.calibration. Type-specific
    // layers (PH, TA_DIC, CO2, etc.) insert additional calibration fields using
    // `{ after: ... }` anchors relative to these. For variable types without an
    // analyzing_instrument (CalculatedVariable, NonMeasuredVariable), these
    // fields are filtered out at runtime by fieldExistsInSchema().
    calibration: [
      {
        path: "analyzing_instrument.calibration.technique_description",
        span: 6,
        placeholderText: "Details of the calibration technique",
      },
      {
        path: "analyzing_instrument.calibration.calibration_location",
        span: 6,
      },
      {
        path: "analyzing_instrument.calibration.frequency",
        span: 6,
        placeholderText: "How often calibrated",
      },
      {
        path: "analyzing_instrument.calibration.last_calibration_date",
        span: 6,
        placeholderText: "YYYY-MM-DD",
      },
      {
        path: "analyzing_instrument.calibration.method_reference",
        placeholderText: "Citation for calibration method",
      },
      "analyzing_instrument.calibration.calibration_certificates",
    ],
    qc: [
      {
        path: "qc_steps_taken",
        inputType: "textarea",
        placeholderText:
          "If quality control procedures are described in a separate document uploaded with the data, provide the name of the document here.",
      },
      { path: "uncertainty", span: 6, placeholderText: "e.g., ±0.01 pH units" },
      {
        path: "uncertainty_definition",
        span: 6,
        placeholderText: "Description of uncertainty calculation",
      },
      { path: "qc_researcher", span: 6 },
      {
        path: "qc_researcher_institution",
        span: 6,
        placeholderText: "Institution name",
      },
    ],
    additional: [
      {
        path: "missing_value_indicators",
        span: 6,
        placeholderText: "e.g., -999, NaN, NA",
      },
      { path: "appropriate_use_quality", span: 6, descriptionModal: true },
      {
        path: "method_reference",
        placeholderText: "Citation for the method used",
      },
      "measurement_researcher",
      {
        path: "other_detailed_information",
        inputType: "textarea",
        placeholderText: "Any additional information about this variable",
      },
    ],
  },
};

/** ContinuousMeasuredVariable */
const CONTINUOUS: HierarchyLayer = {
  name: "ContinuousMeasuredVariable",
  sections: {
    analysis: ["raw_data_calculation_method", "calculation_software_version"],
  },
};

/** CalculatedVariable */
const CALCULATED: HierarchyLayer = {
  name: "CalculatedVariable",
  sections: {
    calculation: [
      {
        path: "calculation_method_and_parameters",
        placeholderText: "e.g., Using CO2SYS with Lueker et al. (2000) constants",
      },
    ],
  },
};

/** MeasuredSedimentFields ∪ DiscreteSedimentVariable */
const SEDIMENT: HierarchyLayer = {
  name: "SedimentVariable",
  sections: {
    sampling: [
      {
        path: "sediment_type",
        span: 6,
        placeholderText: "e.g., mud, sand",
      },
      {
        path: "sediment_sampling_method",
        span: 6,
        placeholderText: "e.g., sediment core, grab sampling, dredging",
      },
      {
        path: "sediment_sampling_depth",
        span: 6,
        placeholderText: "Depth below sediment surface",
      },
      {
        path: "sediment_sampling_water_depth",
        span: 6,
        placeholderText: "Water depth where sediment was collected",
      },
    ],
  },
};

/** MeasuredTA/DICFields ∪ DiscreteTA/DICVariable */
const TA_DIC: HierarchyLayer = {
  name: "TA_DICVariable",
  sections: {
    sampling: [
      {
        path: "sample_preservation.preservative",
        span: 6,
        placeholderText: "e.g., Mercury Chloride",
      },
      {
        path: "sample_preservation.volume",
        span: 6,
        placeholderText: "Volume of preservative used",
      },
      {
        path: "sample_preservation.correction_description",
        placeholderText: "How the preservative effect was corrected for",
      },
    ],
    analysis: [
      {
        path: "titration_type",
        span: 6,
        placeholderText: "Type of titration used",
      },
      {
        path: "titration_cell_type",
        span: 6,
      },
      {
        path: "curve_fitting_method",
        span: 6,
        placeholderText: "Curve fitting method for alkalinity",
      },
      {
        path: "blank_correction",
        placeholderText: "Whether and how results were corrected for blank",
      },
    ],
    calibration: {
      fields: [
        {
          path: "analyzing_instrument.calibration.crm_manufacturer",
          span: 6,
          placeholderText: "e.g., Scripps, JAMSTEC",
        },
        {
          path: "analyzing_instrument.calibration.crm_batch_number",
          span: 6,
          placeholderText: "CRM batch number",
        },
      ],
      position: {
        after: "analyzing_instrument.calibration.calibration_location",
      },
    },
  },
};

/** MeasuredPHFields ∪ DiscretePHVariable ∪ ContinuousPHVariable */
const PH: HierarchyLayer = {
  name: "PHVariable",
  sections: {
    analysis: [
      {
        path: "measurement_temperature",
        span: 6,
        placeholderText: "Temperature at which pH was measured",
      },
      {
        path: "ph_reported_temperature",
        span: 6,
        placeholderText: "Temperature at which pH is reported",
      },
      {
        path: "temperature_correction_method",
        placeholderText: "Method used to correct pH for temperature",
      },
    ],
    calibration: {
      fields: [
        {
          path: "analyzing_instrument.calibration.dye_type_and_manufacturer",
          placeholderText: "e.g., m-cresol purple from Sigma-Aldrich",
        },
        {
          path: "analyzing_instrument.calibration.dye_purified",
          span: 6,
          inputType: "boolean_select",
        },
        {
          path: "analyzing_instrument.calibration.correction_for_unpurified_dye",
          span: 6,
          placeholderText: "Correction method applied",
        },
        {
          path: "analyzing_instrument.calibration.dye_correction_method",
          placeholderText: "Method used to correct for dye effects",
        },
        {
          path: "analyzing_instrument.calibration.ph_of_standards",
          span: 6,
          placeholderText: "pH values of calibration standards",
        },
        {
          path: "analyzing_instrument.calibration.calibration_temperature",
          span: 6,
          placeholderText: "Temperature of calibration",
        },
      ],
      position: {
        after: "analyzing_instrument.calibration.calibration_location",
      },
    },
  },
};

/** MeasuredCO2Fields ∪ DiscreteCO2Variable */
const CO2: HierarchyLayer = {
  name: "CO2Variable",
  sections: {
    sampling: [
      {
        path: "storage_method",
        placeholderText: "How samples were stored before measurement",
      },
    ],
    analysis: [
      {
        path: "headspace_volume",
        span: 6,
        placeholderText: "Volume of headspace (mL)",
      },
      {
        path: "seawater_volume",
        span: 6,
        placeholderText: "Volume of seawater in flask (mL)",
      },
      {
        path: "water_vapor_correction_method",
        placeholderText: "How water vapor pressure was determined",
      },
    ],
    instrument: [
      {
        path: "analyzing_instrument.detector_type",
        span: 6,
        placeholderText: "Type of CO2 gas detector",
      },
      {
        path: "analyzing_instrument.resolution",
        span: 6,
        placeholderText: "Sensor resolution",
      },
      {
        path: "analyzing_instrument.uncertainty",
        span: 6,
        placeholderText: "Sensor uncertainty",
      },
    ],
    calibration: {
      fields: [
        {
          path: "analyzing_instrument.calibration.standard_gas_info.manufacturer",
          span: 6,
          placeholderText: "Standard gas manufacturer",
        },
        {
          path: "analyzing_instrument.calibration.standard_gas_info.concentration",
          span: 6,
          placeholderText: "e.g., 260, 350, 510 ppm",
        },
        {
          path: "analyzing_instrument.calibration.standard_gas_info.uncertainty",
          span: 6,
          placeholderText: "e.g., 0.5%",
        },
        {
          path: "analyzing_instrument.calibration.calibration_temperature",
          span: 6,
          placeholderText: "Temperature of calibration",
        },
      ],
      position: {
        after: "analyzing_instrument.calibration.calibration_location",
      },
    },
  },
};

/** ContinuousCO2Variable — continuous-specific fields */
const CO2_CONTINUOUS: HierarchyLayer = {
  name: "ContinuousCO2Variable",
  sections: {
    sampling: [
      {
        path: "seawater_intake_location",
        span: 6,
        placeholderText: "Whereabouts of the seawater intake",
      },
      {
        path: "seawater_intake_depth",
        span: 6,
        placeholderText: "Water depth of the seawater intake",
      },
      {
        path: "drying_method",
        placeholderText: "Method used to dry gas from equilibrator before CO2 sensor",
      },
    ],
    analysis: [
      {
        path: "pco2_reported_temperature",
        span: 6,
        placeholderText: "e.g., in-situ temperature, temperature of analysis, etc.",
      },
      {
        path: "temperature_correction_method",
        span: 6,
        placeholderText: "How the temperature effect was corrected",
      },
    ],
    instrument: [
      {
        path: "analyzing_instrument.measurement_frequency",
        span: 6,
        placeholderText: "e.g., every 140 seconds except during calibration",
      },
    ],
    calibration: {
      fields: [
        {
          path: "analyzing_instrument.calibration.standard_gas_info.number_of_nonzero_standards",
          span: 6,
          placeholderText: "Number of non-zero standards",
        },
        {
          path: "analyzing_instrument.calibration.standard_gas_info.traceability_to_wmo_standards",
          span: 6,
          placeholderText: "Traceability to WMO standards",
        },
      ],
      position: {
        after: "analyzing_instrument.calibration.standard_gas_info.uncertainty",
      },
    },
    equilibrator: [
      { path: "equilibrator.equilibrator_type", span: 6 },
      {
        path: "equilibrator.volume",
        span: 6,
        placeholderText: "Total volume in liters",
      },
      {
        path: "equilibrator.vented",
        span: 6,
        inputType: "boolean_select",
      },
      {
        path: "equilibrator.water_flow_rate",
        span: 6,
        placeholderText: "Flow rate in L/min",
      },
      {
        path: "equilibrator.headspace_gas_flow_rate",
        span: 6,
        placeholderText: "Flow rate in L/min",
      },
    ],
    equilibrator_temp_sensor: [
      {
        path: "equilibrator_temperature_sensor.location",
        placeholderText: "e.g., Inserted into equilibrator ~5 cm below water level",
      },
      {
        path: "equilibrator_temperature_sensor.manufacturer",
        span: 6,
        placeholderText: "e.g., Hart",
      },
      {
        path: "equilibrator_temperature_sensor.model",
        span: 6,
        placeholderText: "e.g., 1523",
      },
      {
        path: "equilibrator_temperature_sensor.serial_number",
        span: 6,
      },
      {
        path: "equilibrator_temperature_sensor.accuracy",
        span: 6,
        placeholderText: "In degrees Celsius",
      },
      {
        path: "equilibrator_temperature_sensor.precision",
        span: 6,
        placeholderText: "In degrees Celsius",
      },
      {
        path: "equilibrator_temperature_sensor.calibration",
        placeholderText: "e.g., Factory calibration",
      },
      {
        path: "equilibrator_temperature_sensor.comments",
        inputType: "textarea",
        placeholderText: "e.g., Resolution is taken as Precision",
      },
    ],
    equilibrator_pressure_sensor: [
      {
        path: "equilibrator_pressure_sensor.location",
        placeholderText: "e.g., Attached to equilibrator headspace",
      },
      {
        path: "equilibrator_pressure_sensor.manufacturer",
        span: 6,
        placeholderText: "e.g., Setra",
      },
      {
        path: "equilibrator_pressure_sensor.model",
        span: 6,
        placeholderText: "e.g., 270",
      },
      { path: "equilibrator_pressure_sensor.serial_number", span: 6 },
      {
        path: "equilibrator_pressure_sensor.accuracy",
        span: 6,
        placeholderText: "In hPa",
      },
      {
        path: "equilibrator_pressure_sensor.precision",
        span: 6,
        placeholderText: "In hPa",
      },
      {
        path: "equilibrator_pressure_sensor.calibration",
        placeholderText: "e.g., Factory calibration",
      },
      {
        path: "equilibrator_pressure_sensor.comments",
        inputType: "textarea",
        placeholderText: "e.g., Manufacturer's resolution is taken as Precision",
      },
    ],
    atmospheric_pressure_sensor: [
      {
        path: "atmospheric_pressure_sensor.location",
        placeholderText: "e.g., At the base of the radar mast, 48 m above sea level",
      },
      {
        path: "atmospheric_pressure_sensor.manufacturer",
        span: 6,
        placeholderText: "e.g., RM Young",
      },
      {
        path: "atmospheric_pressure_sensor.model",
        span: 6,
        placeholderText: "e.g., 61202V",
      },
      { path: "atmospheric_pressure_sensor.serial_number", span: 6 },
      {
        path: "atmospheric_pressure_sensor.accuracy",
        span: 6,
        placeholderText: "In hPa",
      },
      {
        path: "atmospheric_pressure_sensor.precision",
        span: 6,
        placeholderText: "In hPa",
      },
      {
        path: "atmospheric_pressure_sensor.calibration",
        placeholderText: "e.g., Factory calibration",
      },
      {
        path: "atmospheric_pressure_sensor.comments",
        inputType: "textarea",
        placeholderText: "e.g., Manufacturer's resolution is taken as Precision",
      },
    ],
    marine_air: [
      {
        path: "marine_air_measurement.measured",
        span: 6,
        inputType: "boolean_select",
      },
      {
        path: "marine_air_measurement.measurement_interval",
        span: 6,
        placeholderText: "e.g., 5 readings in a group every 5 hours",
      },
      {
        path: "marine_air_measurement.location_and_height",
        placeholderText: "Location and height of the marine air intake",
      },
      {
        path: "marine_air_measurement.drying_method",
        placeholderText: "Method used to dry the gas stream",
      },
    ],
  },
};

/** HPLCVariable */
const HPLC: HierarchyLayer = {
  name: "HPLCVariable",
  sections: {
    analysis: [
      { path: "hplc_lab", span: 6, placeholderText: "e.g., NASA_GSFC" },
      {
        path: "hplc_lab_technician",
        span: 6,
        placeholderText: "Name and contact info",
      },
    ],
  },
};

/** MeasuredPhysiologicalFields mixin */
const PHYSIOLOGICAL: HierarchyLayer = {
  name: "PhysiologicalVariable",
  sections: {
    biological: [
      {
        path: "biological_subject",
        placeholderText: "e.g., Crassostrea gigas (Pacific oyster)",
      },
      {
        path: "species_identification_code",
        span: 6,
        placeholderText: "e.g., AphiaID 140656",
      },
      {
        path: "taxonomic_code_system",
        span: 6,
      },
      {
        path: "life_stage",
        span: 6,
        inputType: "enum_with_other",
      },
    ],
  },
};

/** SocioeconomicVariable-specific fields */
const SOCIOECONOMIC: HierarchyLayer = {
  name: "SocioeconomicVariable",
  sections: {
    study_details: [
      "quantitative_or_qualitative",
      {
        path: "social_study_type",
        span: 6,
        inputType: "enum_with_other",
      },
      {
        path: "social_study_site_characterization",
        inputType: "textarea",
        placeholderText: "e.g., 2023-2024, coastal communities in Maine, USA",
      },
    ],
  },
};

// =============================================================================
// Variable Type Layer Stacks
// =============================================================================

/**
 * Maps each schema key to its hierarchy layer stack.
 * The layers are applied in order to build the field list for each section.
 *
 * Uses Record<string, ...> rather than a strict union type for maintainability;
 * the VARIABLE_TYPE_LAYERS test validates every VARIABLE_SCHEMA_MAP key is present.
 *
 * The BASE layer includes the shared `analyzing_instrument.*` and calibration
 * fields inherited from the protocol's AnalyzingInstrument/Calibration base
 * classes. For variable types without an analyzing_instrument (CalculatedVariable,
 * NonMeasuredVariable) those fields are filtered out at runtime by
 * fieldExistsInSchema() in VariableModal.tsx. Type-specific layers (PH, TA_DIC,
 * CO2, etc.) insert additional calibration fields using `{ after }` anchors
 * relative to BASE's shared calibration fields.
 */
export const VARIABLE_TYPE_LAYERS: Record<string, HierarchyLayer[]> = {
  // Discrete
  DiscretePHVariable: [BASE, PH],
  DiscreteTAVariable: [BASE, TA_DIC],
  DiscreteDICVariable: [BASE, TA_DIC],
  DiscreteSedimentVariable: [BASE, SEDIMENT],
  DiscreteCO2Variable: [BASE, CO2],
  HPLCVariable: [BASE, HPLC],
  DiscretePhysiologicalVariable: [BASE, PHYSIOLOGICAL],
  DiscreteMeasuredVariable: [BASE],
  // Continuous
  ContinuousPHVariable: [BASE, CONTINUOUS, PH],
  ContinuousTAVariable: [BASE, CONTINUOUS, TA_DIC],
  ContinuousDICVariable: [BASE, CONTINUOUS, TA_DIC],
  ContinuousSedimentVariable: [BASE, CONTINUOUS, SEDIMENT],
  ContinuousCO2Variable: [BASE, CONTINUOUS, CO2, CO2_CONTINUOUS],
  ContinuousPhysiologicalVariable: [BASE, CONTINUOUS, PHYSIOLOGICAL],
  ContinuousMeasuredVariable: [BASE, CONTINUOUS],
  // Other
  CalculatedVariable: [BASE, CALCULATED],
  SocioeconomicVariable: [BASE, SOCIOECONOMIC],
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
  { key: "biological", label: "Biological Subject", icon: IconLeaf },
  { key: "study_details", label: "Study Details", icon: IconUsers },
  { key: "equilibrator", label: "Equilibrator", icon: IconDroplet },
  {
    key: "equilibrator_temp_sensor",
    label: "Equil. Temperature Sensor",
    icon: IconTemperature,
  },
  {
    key: "equilibrator_pressure_sensor",
    label: "Equil. Pressure Sensor",
    icon: IconGauge,
  },
  {
    key: "atmospheric_pressure_sensor",
    label: "Atmospheric Pressure Sensor",
    icon: IconCloud,
  },
  { key: "marine_air", label: "CO₂ in Marine Air", icon: IconWind },
  { key: "calculation", label: "Calculation Details", icon: IconCalculator },
  { key: "qc", label: "Quality Control", icon: IconShieldCheck },
  {
    key: "additional",
    label: "Additional Information",
    icon: IconFileDescription,
  },
];

function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Returns the accordion config for a specific variable type's schema key.
 * Builds sections from the type's layer stack, returning only sections that have fields.
 * Returns empty array for unknown schema keys.
 * Results are cached per schemaKey since layer definitions are static.
 */
const accordionConfigCache = new Map<string, AccordionSection[]>();

export function getAccordionConfig(schemaKey: string): AccordionSection[] {
  const cached = accordionConfigCache.get(schemaKey);
  if (cached) return cached;

  const layers = VARIABLE_TYPE_LAYERS[schemaKey];
  if (!layers) return [];

  const config = ACCORDION_SECTIONS.map((s) => ({
    ...s,
    fields: buildSectionFields(s.key, layers),
  })).filter((s) => s.fields.length > 0);

  deepFreeze(config);
  accordionConfigCache.set(schemaKey, config);
  return config;
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
  sampling: string | undefined,
): string | null {
  if (!variableType) return null;

  const typeMap = VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
  if (!typeMap) return null;

  // String value = direct mapping, no genesis/sampling needed
  if (typeof typeMap === "string") {
    return typeMap;
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
 * Maps UI "other" + genesis to the internal variable type.
 * For non-"other" types, returns the type unchanged.
 */
export function resolveVariableType(
  uiVariableType: string | undefined,
  genesis: string | undefined,
): string | undefined {
  if (uiVariableType !== "other") return uiVariableType;
  if (!genesis) return undefined;
  if (genesis === "contextual") return "non_measured";
  return "other";
}

// Build reverse lookup: schema_class → { variable_type, genesis, sampling }
// Used by normalizeVariableFields to fix inconsistencies on load.
interface SchemaClassInfo {
  variable_type: string;
  genesis?: string;
  sampling?: string;
}

function buildSchemaClassLookup(): Record<string, SchemaClassInfo> {
  const lookup: Record<string, SchemaClassInfo> = {};
  for (const [varType, topLevel] of Object.entries(VARIABLE_SCHEMA_MAP)) {
    // String value = direct mapping (e.g., non_measured → NonMeasuredVariable)
    if (typeof topLevel === "string") {
      lookup[topLevel] = { variable_type: varType };
      continue;
    }
    for (const [key, genesisValue] of Object.entries(topLevel)) {
      if (key === "placeholderOverrides") continue;
      if (typeof genesisValue === "string") {
        // Calculated — genesis is the key, no sampling
        // Don't overwrite if already set (CalculatedVariable is shared)
        if (!lookup[genesisValue]) {
          lookup[genesisValue] = { variable_type: varType, genesis: key };
        }
      } else if (typeof genesisValue === "object" && genesisValue !== null) {
        for (const [samplingKey, schemaClass] of Object.entries(
          genesisValue as Record<string, string>,
        )) {
          if (typeof schemaClass === "string") {
            lookup[schemaClass] = { variable_type: varType, genesis: key, sampling: samplingKey };
          }
        }
      }
    }
  }
  return lookup;
}

const SCHEMA_CLASS_LOOKUP = buildSchemaClassLookup();

/**
 * Normalizes variable fields to be consistent with schema_class.
 * Called on load/import to fix any inconsistencies between schema_class
 * and its sibling fields (variable_type, genesis, sampling).
 *
 * schema_class is the source of truth. If sibling fields conflict,
 * they are overridden. For shared classes like CalculatedVariable,
 * variable_type is trusted if present.
 */
export function normalizeVariableFields(
  variable: Record<string, unknown>,
): Record<string, unknown> {
  // Guard against non-object entries in imported data
  if (!variable || typeof variable !== "object" || Array.isArray(variable)) {
    return variable;
  }

  // Strip any _-prefixed UI-only fields (legacy _schemaKey, _variableType, etc.)
  const hasUnderscoreKeys = Object.keys(variable).some((k) => k.startsWith("_"));
  if (hasUnderscoreKeys) {
    variable = Object.fromEntries(Object.entries(variable).filter(([k]) => !k.startsWith("_")));
  }

  let schemaClass = variable.schema_class as string | undefined;

  // If schema_class is missing or unknown, try to derive from sibling fields
  if (!schemaClass || !SCHEMA_CLASS_LOOKUP[schemaClass]) {
    const varType = variable.variable_type as string | undefined;
    const derived = varType
      ? getSchemaKey(
          varType,
          variable.genesis as string | undefined,
          variable.sampling as string | undefined,
        )
      : null;
    if (!derived) return variable;
    schemaClass = derived;
    variable = { ...variable, schema_class: schemaClass };
  }

  const expected = SCHEMA_CLASS_LOOKUP[schemaClass];
  if (!expected) return variable;

  const changes: Record<string, unknown> = {};

  // For shared classes (CalculatedVariable), trust existing variable_type
  // if it's a type that supports calculated variables
  const isSharedClass = schemaClass === "CalculatedVariable";
  if (isSharedClass) {
    const validCalculatedTypes = new Set(
      Object.entries(VARIABLE_SCHEMA_MAP)
        .filter(([, v]) => typeof v === "object" && "calculated" in v)
        .map(([k]) => k),
    );
    const currentType = variable.variable_type as string | undefined;
    if (!currentType || !validCalculatedTypes.has(currentType)) {
      changes.variable_type = "other";
    }
  } else {
    if (variable.variable_type !== expected.variable_type) {
      changes.variable_type = expected.variable_type;
    }
  }

  // Fix genesis
  if (expected.genesis !== undefined) {
    if (variable.genesis !== expected.genesis) {
      changes.genesis = expected.genesis;
    }
  } else {
    // No genesis expected (NonMeasuredVariable) — clear it
    if (variable.genesis !== undefined) {
      changes.genesis = undefined;
    }
  }

  // Fix sampling
  if (expected.sampling !== undefined) {
    if (variable.sampling !== expected.sampling) {
      changes.sampling = expected.sampling;
    }
  } else {
    // No sampling expected (Calculated, NonMeasured) — clear it
    if (variable.sampling !== undefined) {
      changes.sampling = undefined;
    }
  }

  if (Object.keys(changes).length === 0) return variable;
  return { ...variable, ...changes };
}

/**
 * Like getSchemaKey but handles "other" → effective type resolution first.
 * Use this in the UI layer; validation/export paths should use getSchemaKey directly.
 */
export function getSchemaKeyForUI(
  uiVariableType: string | undefined,
  genesis: string | undefined,
  sampling: string | undefined,
): string | null {
  if (uiVariableType === "other") {
    if (genesis === "contextual") return getSchemaKey("non_measured", undefined, undefined);
    return getSchemaKey("other", genesis, sampling);
  }
  return getSchemaKey(uiVariableType, genesis, sampling);
}

/**
 * Gets a placeholder override for a specific field based on variable type.
 * Returns undefined if no override exists (use config default).
 */
export function getPlaceholderOverride(
  variableType: string | undefined,
  fieldPath: string,
): string | undefined {
  if (!variableType) return undefined;
  const typeConfig = VARIABLE_SCHEMA_MAP[variableType as keyof typeof VARIABLE_SCHEMA_MAP];
  if (!typeConfig || typeof typeConfig === "string" || !("placeholderOverrides" in typeConfig))
    return undefined;
  const overrides = typeConfig.placeholderOverrides as Record<string, string> | undefined;
  return overrides?.[fieldPath];
}

// Dedicated AJV instance for field stripping only — never used for user-facing validation
const stripAjv = new Ajv2019({ removeAdditional: true, strict: false });

// WeakMap keyed by rootSchema object so validators are cache-correct when different
// schemas are used (e.g., in tests). In production the app has one immutable bundled
// schema, so the WeakMap always resolves to the same inner Map.
const stripValidatorCache = new WeakMap<object, Map<string, ReturnType<typeof stripAjv.compile>>>();

// AJV's removeAdditional is skipped when any required keyword fails — which happens
// whenever the user switches variable types and required fields from the new type are
// missing. Dropping required throughout the schema makes removeAdditional unconditional.
function dropRequired(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(dropRequired);
  const { required: _required, ...rest } = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, dropRequired(v)]));
}

/**
 * Strips fields from a variable that are not valid for its schema_class.
 *
 * Uses AJV's removeAdditional feature to recursively remove any properties
 * not present in the schema, including nested objects (e.g., calibration fields
 * that don't belong to the current instrument type).
 *
 * required keywords are removed from the compiled schema so that stripping works
 * even when the variable is mid-transition (e.g., type switch left required fields
 * from the new type unpopulated). Validation (not stripping) enforces required fields.
 *
 * Compiled validators are cached per (rootSchema, schema_class) pair — correct
 * across different schema objects and zero-overhead in the common single-schema case.
 *
 * @param variable - Variable data (must have a schema_class field)
 * @param rootSchema - The full bundled schema containing $defs
 * @returns A new variable object with extra fields removed, or the original if schema_class is unknown
 */
export function stripExtraVariableFields(
  variable: Record<string, unknown>,
  rootSchema: JSONSchema,
): Record<string, unknown> {
  const schemaClass = variable.schema_class as string | undefined;
  if (!schemaClass) return variable;

  const defs = (rootSchema as Record<string, unknown>).$defs as
    | Record<string, JSONSchema>
    | undefined;
  if (!defs?.[schemaClass]) return variable;

  let classCache = stripValidatorCache.get(rootSchema as object);
  if (!classCache) {
    classCache = new Map();
    stripValidatorCache.set(rootSchema as object, classCache);
  }

  let validate = classCache.get(schemaClass);
  if (!validate) {
    const stripSchema = dropRequired({ ...defs[schemaClass], $defs: defs });
    validate = stripAjv.compile(stripSchema as object);
    classCache.set(schemaClass, validate);
  }

  // Deep clone — AJV mutates the data object in place
  const copy = JSON.parse(JSON.stringify(variable)) as Record<string, unknown>;
  validate(copy);
  return copy;
}
