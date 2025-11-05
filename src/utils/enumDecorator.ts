/**
 * Utility to generate formatted enumNames from JSON Schema enum definitions
 */

/**
 * Custom overrides for specific enum values that need special formatting
 * Add entries here for enum values that shouldn't follow the default snake_case to Title Case conversion
 */
const ENUM_OVERRIDES: Record<string, string> = {
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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
