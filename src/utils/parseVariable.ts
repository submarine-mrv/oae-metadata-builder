import type { JSONSchema } from "@/components/schemaUtils";
import {
  normalizeVariableFields,
  stripExtraVariableFields,
} from "@/components/VariableModal/variableModalConfig";
import type { DraftVariable } from "@/types/variable";
import { cleanVariableData } from "@/utils/formDataCleanup";

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
export function parseVariable(raw: Record<string, unknown>, rootSchema: JSONSchema): DraftVariable {
  const cleaned = cleanVariableData(
    stripExtraVariableFields(normalizeVariableFields(raw), rootSchema) as Record<string, unknown>,
  );
  // The one cast: structural cleaning guarantees the discriminant and that any
  // surviving field is a real field of that schema_class, but not that values
  // type-check or that required fields are present — which is what DraftVariable
  // models (everything optional but the discriminant). Completeness/value checks
  // are validateDataset()'s job.
  return cleaned as DraftVariable;
}

/**
 * parseVariable over an array, dropping non-object entries (defensive against
 * malformed imported/restored data). Non-array input yields an empty array.
 */
export function parseVariables(raws: unknown, rootSchema: JSONSchema): DraftVariable[] {
  if (!Array.isArray(raws)) return [];
  return raws
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v))
    .map((v) => parseVariable(v, rootSchema));
}
