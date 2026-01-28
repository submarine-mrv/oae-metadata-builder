/**
 * Utility to generate formatted enumNames from JSON Schema enum definitions
 */

/**
 * Custom overrides for specific enum values that need special formatting
 * Add entries here for enum values that shouldn't follow the default snake_case to Title Case conversion
 */
const ENUM_OVERRIDES: Record<string, string> = {
  // Instrument type
  //     - CTD, DIC, CO2, TA, pH, Sea-Bird SeaFET
  // SamplingInstrumentType
  ctd_rosette: "CTD Rosette",
  edna_sampler: "eDNA Sampler",
  flask_for_discrete_co2_measurement: "Flask For Discrete CO2 Measurement",

  // AnalyzingInstrumentType
  ctd_sensor: "CTD Sensor",
  dic_analyzers_based_on_coulometers: "DIC Analyzers Based On Coulometers",
  dic_analyzers_based_on_co2_gas_detectors:
    "DIC Analyzers Based On CO2 Gas Detectors",
  autonomous_dic_sensor: "Autonomous DIC Sensor",
  autonomous_ta_sensor: "Autonomous TA Sensor",
  handheld_ph_spectrophotometer: "Handheld pH Spectrophotometer",
  ph_electrode: "pH Electrode",
  sea_bird_seafet_v1: "Sea-Bird SeaFET V1",
  sea_bird_seafet_v2: "Sea-Bird SeaFET V2",
  sea_bird_seaphox: "Sea-Bird SeapHOx",
  ysi: "YSI",
  high_performance_liquid_chromatography:
    "High Performance Liquid Chromatogrpahy (HPLC)",
  acoustic_doppler_current_profiler: "Acoustic Doppler Current Profiler (ADCP)",
  isotope_ratio_mass_spectrometers: "Isotope Ratio Mass Spectrometers (IRMS)",

  // Researcher ID Type
  orcid: "ORCID",
  researcher_id: "ResearcherID",
  ocean_expert: "OceanExpert",
  // MassConcentrationUnit QUDT units with proper formatting
  "unit:KiloGM-PER-M3": "kg/m³",
  "unit:MicroGM-PER-L": "μg/L",
  "unit:MicroGM-PER-L-DAY": "μg/L/day",
  "unit:MicroGM-PER-MilliL": "μg/mL",
  "unit:MilliGM-PER-L": "mg/L",
  "unit:MilliGM-PER-M3": "mg/m³",
  "unit:MilliGM-PER-MilliL": "mg/mL",
  "unit:NanoGM-PER-L": "ng/L",
  "unit:NanoGM-PER-MilliL": "ng/mL",
  "unit:PicoGM-PER-MilliL": "pg/mL"
};

/**
 * Format an enum value to a readable title
 * Example: "mg_rich_olivine" -> "Mg Rich Olivine"
 *
 * Checks ENUM_OVERRIDES first for custom formatting, then applies default formatting
 */
export function formatEnumTitle(value: string): string {
  // Check for custom override first
  if (ENUM_OVERRIDES[value]) {
    return ENUM_OVERRIDES[value];
  }

  // Default formatting: snake_case to Title Case
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generate enumNames mappings from schema for specified enum definitions
 *
 * @param schema - The JSON schema containing $defs with enum definitions
 * @param enumDefNames - Array of enum definition names to process (e.g., ["FeedstockType", "DosingDeliveryType"])
 * @returns A map of enum definition names to their formatted enumNames arrays
 *
 * @example
 * const schema = { $defs: { FeedstockType: { enum: ["lime", "portlandite"] } } };
 * const result = generateEnumNames(schema, ["FeedstockType"]);
 * // Returns: { FeedstockType: ["Lime", "Portlandite"] }
 */
export function generateEnumNames(
  schema: any,
  enumDefNames: string[]
): Record<string, string[]> {
  const enumNamesMap: Record<string, string[]> = {};

  enumDefNames.forEach((enumName) => {
    const enumDef = schema.$defs?.[enumName];
    if (enumDef?.enum && Array.isArray(enumDef.enum)) {
      enumNamesMap[enumName] = enumDef.enum.map(formatEnumTitle);
    }
  });

  return enumNamesMap;
}
