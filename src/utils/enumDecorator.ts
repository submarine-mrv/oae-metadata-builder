/**
 * Utility to generate formatted enumNames from JSON Schema enum definitions
 */

/**
 * Format an enum value to a readable title
 * Example: "mg_rich_olivine" -> "Mg Rich Olivine"
 */
export function formatEnumTitle(value: string): string {
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
