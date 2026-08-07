/**
 * The 19 concrete variable classes — the values LinkML's `designates_type` emits
 * for `schema_class`. The 18 field classes are hand-maintained in sync with the
 * discriminated `variables` union in the bundled schema;
 * `variablesDiscriminator.test.ts` reads those same branch names, so a drift
 * would surface there.
 *
 * ModelVariable is the 19th and is deliberately absent from that union: it
 * descends from Variable but not from FieldVariable, which is what
 * FieldDataset.variables ranges over. It belongs to ModelOutputDataset.variables
 * and shares DraftVariable, so it is listed here.
 */
export type VariableSchemaClass =
  | "ModelVariable"
  | "NonMeasuredVariable"
  | "CalculatedVariable"
  | "SocioeconomicVariable"
  | "DiscreteMeasuredVariable"
  | "ContinuousMeasuredVariable"
  | "ContinuousPHVariable"
  | "ContinuousTAVariable"
  | "ContinuousDICVariable"
  | "ContinuousSedimentVariable"
  | "ContinuousCO2Variable"
  | "ContinuousPhysiologicalVariable"
  | "DiscretePHVariable"
  | "DiscreteTAVariable"
  | "DiscreteDICVariable"
  | "DiscreteSedimentVariable"
  | "DiscreteCO2Variable"
  | "HPLCVariable"
  | "DiscretePhysiologicalVariable";

/**
 * A variable as held in application state: a draft where every field is optional
 * and only the `schema_class` discriminant is typed, so the variable type-switch
 * logic narrows on it. Type-specific fields stay loose via the index signature —
 * RJSF and the Variable modal render them from the schema. Completeness is
 * checked at validateDataset (each draft against its `schema_class` branch in the
 * bundled schema), not here.
 */
export interface DraftVariable {
  schema_class?: VariableSchemaClass;
  [key: string]: unknown;
}
