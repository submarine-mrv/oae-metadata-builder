import {
  normalizeVariableFields,
  stripExtraVariableFields
} from "@/components/VariableModal/variableModalConfig";
import { cleanVariableData } from "@/utils/formDataCleanup";
import type { JSONSchema } from "@/components/schemaUtils";

/**
 * Normalizes a single variable into clean, schema-faithful data in one pass:
 *   normalizeVariableFields → stripExtraVariableFields → cleanVariableData
 *
 * Run this at every boundary where variable data enters application state
 * (modal save, import, session restore) so stored variables are always clean —
 * no orphaned type-switch fields, no empty strings. Validation can then trust the
 * data and check it directly against its schema_class, without re-cleaning.
 *
 * Total and lenient: when schema_class can't be determined the normalize/strip
 * steps are no-ops and the (empty-stripped) input is returned, matching the prior
 * import behavior.
 */
export function parseVariable(
  raw: Record<string, unknown>,
  rootSchema: JSONSchema
): Record<string, unknown> {
  return cleanVariableData(
    stripExtraVariableFields(
      normalizeVariableFields(raw),
      rootSchema
    ) as Record<string, unknown>
  );
}

/**
 * parseVariable over an array, dropping non-object entries (defensive against
 * malformed imported/restored data). Non-array input yields an empty array.
 */
export function parseVariables(
  raws: unknown,
  rootSchema: JSONSchema
): Record<string, unknown>[] {
  if (!Array.isArray(raws)) return [];
  return raws
    .filter(
      (v): v is Record<string, unknown> =>
        !!v && typeof v === "object" && !Array.isArray(v)
    )
    .map((v) => parseVariable(v, rootSchema));
}
