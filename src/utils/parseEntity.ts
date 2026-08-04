import type { JSONSchema } from "@/components/schemaUtils";
import {
  FIELD_TO_MODEL_VARIABLE_TYPE,
  MODEL_TO_FIELD_VARIABLE_TYPE,
  MODEL_VARIABLE_SCHEMA_KEY,
  MODEL_VARIABLE_TYPE_VALUES,
  resolveFieldVariableType,
} from "@/components/VariableModal/variableModalConfig";
import type { DraftDataset, DraftExperiment, DraftProject, FormDataRecord } from "@/types/forms";
import {
  cleanupConditionalFields,
  cleanupNestedConditionalFields,
  DATASET_CONDITIONAL_FIELDS,
  EXPERIMENT_CONDITIONAL_FIELDS,
  MODEL_NESTED_CONDITIONAL_FIELDS,
} from "@/utils/conditionalFields";
import { cleanDatasetFormDataForType, isModelOutputType } from "@/utils/datasetFields";
import {
  cleanFormDataForType,
  enforceModelExclusivity,
  getExperimentSchemaType,
} from "@/utils/experimentFields";
import { cleanFormData } from "@/utils/formDataCleanup";
import { parseVariables } from "@/utils/parseVariable";

/**
 * Per-entity parse boundaries, following the parseVariable pattern: every path
 * where entity data enters application state (form onChange, import, session
 * restore) funnels through the entity's parse function, which establishes the
 * entity's own-invariants in one pass. Downstream code trusts the Draft type
 * and does not re-clean or re-check.
 *
 * All three are total and lenient: malformed input degrades to {} or is passed
 * through for AJV to reject at validation time — parsing never throws.
 *
 * Derived IDs (project_id on experiments/datasets, experiment_id on datasets)
 * are NOT set here; they are denormalized copies synced by AppStateContext
 * propagation.
 */

function asRecord(raw: unknown): FormDataRecord {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as FormDataRecord)
    : {};
}

/**
 * Projects have a single schema and no type selectors — parsing is just the
 * shared cleanup (drop empty strings/objects/nulls).
 */
export function parseProject(raw: unknown): DraftProject {
  return cleanFormData(asRecord(raw)) as DraftProject;
}

/**
 * Establishes the experiment invariants:
 * - model exclusivity on experiment_types (with `prev`, the form-transition
 *   recency rule: latest selection wins; without `prev`, static resolution:
 *   model wins);
 * - only fields valid for the resolved schema type survive (closes the import/
 *   restore hole where fields of another type — or a retired type — persist);
 * - conditional custom fields are dropped when their trigger isn't met.
 */
export function parseExperiment(raw: unknown, prev?: DraftExperiment): DraftExperiment {
  let data = asRecord(raw);

  if (Array.isArray(data.experiment_types)) {
    const rawTypes = data.experiment_types.filter((t): t is string => typeof t === "string");
    const prevTypes = Array.isArray(prev?.experiment_types) ? prev.experiment_types : [];
    data = { ...data, experiment_types: enforceModelExclusivity(rawTypes, prevTypes) };
  }

  const schemaType = getExperimentSchemaType(
    Array.isArray(data.experiment_types) ? (data.experiment_types as string[]) : [],
  );
  data = cleanFormDataForType(data, schemaType);
  data = cleanupConditionalFields(data, EXPERIMENT_CONDITIONAL_FIELDS);
  data = cleanupNestedConditionalFields(data, MODEL_NESTED_CONDITIONAL_FIELDS);
  return cleanFormData(data) as DraftExperiment;
}

/**
 * Establishes the dataset invariants:
 * - only fields valid for the dataset_type survive;
 * - variables are themselves parsed (normalize → strip → clean). Both dataset
 *   types carry `variables`: FieldDataset holds Variable subclasses, while
 *   ModelOutputDataset holds ModelVariable. Variables on a model dataset are
 *   coerced to ModelVariable — legacy/imported data (or a dataset_type switch)
 *   can carry a field class like DiscretePHVariable, which the model schema
 *   does not allow. Coercing rather than dropping keeps the user's work
 *   (name, units, …); normalize/strip then fix genesis and remove the
 *   in-situ-only fields that ModelVariable has no place for.
 * - model-output conditional custom fields are dropped when untriggered.
 *
 * rootSchema is the bundled schema (getBaseSchema()), threaded through to
 * parseVariables like at the variable-modal boundary.
 */
export function parseDataset(raw: unknown, rootSchema: JSONSchema): DraftDataset {
  let data = asRecord(raw);
  const datasetType = typeof data.dataset_type === "string" ? data.dataset_type : undefined;
  const isModelOutput = isModelOutputType(datasetType);

  if (datasetType) {
    data = cleanDatasetFormDataForType(data, datasetType);
  }

  if (isModelOutput) {
    data = cleanupConditionalFields(data, DATASET_CONDITIONAL_FIELDS);
  }

  if (data.variables !== undefined) {
    const raws = isModelOutput
      ? coerceToModelVariables(data.variables)
      : coerceOutOfModelVariables(data.variables);
    data = { ...data, variables: parseVariables(raws, rootSchema) };
  }

  return cleanFormData(data) as DraftDataset;
}

function mapVariables(
  variables: unknown,
  fn: (v: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  if (!Array.isArray(variables)) return variables;
  return variables.map((v) =>
    v && typeof v === "object" && !Array.isArray(v) ? fn(v as Record<string, unknown>) : v,
  );
}

/**
 * Forces schema_class to ModelVariable — the only class a model dataset allows —
 * and translates variable_type from VariableType into ModelVariableType, since
 * the two classes draw on different vocabularies.
 */
function coerceToModelVariables(variables: unknown): unknown {
  return mapVariables(variables, (v) => ({
    ...v,
    schema_class: MODEL_VARIABLE_SCHEMA_KEY,
    variable_type: toModelVariableType(v),
  }));
}

/**
 * The ModelVariableType for a variable arriving in a model dataset, whatever
 * shape it comes in: a field variable being switched over, a hand-authored
 * import with no schema_class, or an entry already classed ModelVariable but
 * still carrying a field-vocabulary type.
 */
function toModelVariableType(v: Record<string, unknown>): string {
  const stored = typeof v.variable_type === "string" ? v.variable_type : undefined;

  // A concrete field class pins the type, and schema_class is the source of
  // truth, so it wins over a conflicting stored value. ModelVariable pins
  // nothing here — it is the class being coerced *to*, so for those entries
  // only the stored value carries meaning.
  if (v.schema_class !== MODEL_VARIABLE_SCHEMA_KEY) {
    const pinned = resolveFieldVariableType(v);
    if (pinned && pinned !== stored) return FIELD_TO_MODEL_VARIABLE_TYPE[pinned] ?? "other";
  }

  // Nothing overrides the stored value: keep it when it is already a model type
  // — most (temperature, horizontal_velocity, …) have no field equivalent to
  // translate through — otherwise translate it out of the field vocabulary.
  if (stored && MODEL_VARIABLE_TYPE_VALUES.has(stored)) return stored;
  return (stored && FIELD_TO_MODEL_VARIABLE_TYPE[stored]) ?? "other";
}

/**
 * The mirror of coerceToModelVariables: a ModelVariable that lands in a field
 * dataset (via a dataset_type switch, or imported data) carries a schema_class
 * and a variable_type the field vocabulary does not have. CalculatedVariable is
 * the closest field class — model output is derived, never sampled — so genesis
 * is set alongside it and normalize/strip fill in the rest.
 */
function coerceOutOfModelVariables(variables: unknown): unknown {
  return mapVariables(variables, (v) => {
    if (v.schema_class !== MODEL_VARIABLE_SCHEMA_KEY) return v;
    const varType = typeof v.variable_type === "string" ? v.variable_type : undefined;
    return {
      ...v,
      schema_class: "CalculatedVariable",
      genesis: "calculated",
      variable_type: (varType && MODEL_TO_FIELD_VARIABLE_TYPE[varType]) ?? "other",
    };
  });
}
