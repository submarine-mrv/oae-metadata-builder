/**
 * Utilities for managing conditional field data cleanup.
 *
 * When using RJSF with conditional fields (allOf/if/then) and additionalProperties: true,
 * orphaned conditional field data will be rendered as "additional properties" with
 * key/value editors. This utility prevents that by cleaning up conditional field data
 * when the trigger condition is no longer met.
 *
 * Pattern: field === triggerValue → customField appears
 *          field !== triggerValue → customField data should be removed
 */

import type { FormDataRecord } from "@/types/forms";

/**
 * Configuration for a conditional field pair
 */
export interface ConditionalFieldPair {
  /** The field name that triggers the conditional (e.g., "alkalinity_feedstock") */
  triggerField: string;
  /** The value that triggers the conditional field to appear (e.g., "other") */
  triggerValue: unknown;
  /** The conditional field name that appears when condition is met (e.g., "alkalinity_feedstock_custom") */
  customField: string;
  /** How to match: "exact" (default) checks equality, "array-contains" checks if array includes triggerValue */
  matchMode?: "exact" | "array-contains";
}

/**
 * Cleans up conditional custom fields when their trigger conditions are not met.
 *
 * This function should be called in the form's onChange handler to automatically
 * remove orphaned conditional field data when users change trigger field values.
 *
 * @param formData - The current form data (will not be mutated)
 * @param conditionalPairs - Array of conditional field pair configurations
 * @returns New formData object with orphaned conditional fields removed
 *
 * @example
 * // Define conditional pairs for your form
 * const EXPERIMENT_CONDITIONALS: ConditionalFieldPair[] = [
 *   {
 *     triggerField: "alkalinity_feedstock",
 *     triggerValue: "other",
 *     customField: "alkalinity_feedstock_custom"
 *   }
 * ];
 *
 * // Use in onChange handler
 * const handleFormChange = (e) => {
 *   let newData = e.formData;
 *   newData = cleanupConditionalFields(newData, EXPERIMENT_CONDITIONALS);
 *   setFormData(newData);
 * };
 */
/**
 * Configuration for a conditional field pair nested inside an array field
 */
export interface NestedConditionalFieldPair extends ConditionalFieldPair {
  /** The array field containing items with conditional fields (e.g., "model_components") */
  arrayField: string;
}

/**
 * Cleans up conditional custom fields inside array items when their trigger conditions are not met.
 *
 * Same logic as cleanupConditionalFields but operates on each item within a named array field.
 */
export function cleanupNestedConditionalFields<T extends FormDataRecord>(
  formData: T,
  nestedPairs: NestedConditionalFieldPair[]
): T {
  let cleanedData = { ...formData } as T;

  nestedPairs.forEach(({ arrayField, triggerField, triggerValue, customField }) => {
    const items = cleanedData[arrayField];
    if (!Array.isArray(items)) return;

    let changed = false;
    const cleanedItems = items.map((item: FormDataRecord) => {
      if (!item || typeof item !== "object") return item;
      if (item[triggerField] !== triggerValue && customField in item) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [customField]: _removed, ...rest } = item;
        changed = true;
        return rest;
      }
      return item;
    });

    if (changed) {
      cleanedData = { ...cleanedData, [arrayField]: cleanedItems } as T;
    }
  });

  return cleanedData;
}

/**
 * Checks whether a conditional trigger condition is met.
 * - "exact" (default): currentValue === triggerValue
 * - "array-contains": Array.isArray(currentValue) && currentValue.includes(triggerValue)
 */
function isConditionMet(
  currentValue: unknown,
  triggerValue: unknown,
  matchMode: "exact" | "array-contains" = "exact"
): boolean {
  if (matchMode === "array-contains") {
    return Array.isArray(currentValue) && currentValue.includes(triggerValue);
  }
  return currentValue === triggerValue;
}

export function cleanupConditionalFields<T extends FormDataRecord>(
  formData: T,
  conditionalPairs: ConditionalFieldPair[]
): T {
  let cleanedData = { ...formData } as T;

  conditionalPairs.forEach(({ triggerField, triggerValue, customField, matchMode }) => {
    const currentValue = cleanedData[triggerField];

    // If trigger condition is not met and custom field exists, remove it
    if (!isConditionMet(currentValue, triggerValue, matchMode) && customField in cleanedData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [customField]: _removed, ...rest } = cleanedData;
      cleanedData = rest as T;
    }
  });

  return cleanedData;
}
