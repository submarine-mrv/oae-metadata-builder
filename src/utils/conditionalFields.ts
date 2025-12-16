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

/**
 * Configuration for a conditional field pair
 */
export interface ConditionalFieldPair {
  /** The field name that triggers the conditional (e.g., "alkalinity_feedstock") */
  triggerField: string;
  /** The value that triggers the conditional field to appear (e.g., "other") */
  triggerValue: any;
  /** The conditional field name that appears when condition is met (e.g., "alkalinity_feedstock_custom") */
  customField: string;
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
export function cleanupConditionalFields(
  formData: any,
  conditionalPairs: ConditionalFieldPair[]
): any {
  let cleanedData = { ...formData };

  conditionalPairs.forEach(({ triggerField, triggerValue, customField }) => {
    const currentValue = cleanedData[triggerField];

    // If trigger condition is not met and custom field exists, remove it
    if (currentValue !== triggerValue && customField in cleanedData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [customField]: _removed, ...rest } = cleanedData;
      cleanedData = rest;
    }
  });

  return cleanedData;
}
