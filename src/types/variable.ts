/**
 * The 18 concrete variable classes — the values LinkML's `designates_type` emits
 * for `schema_class`. Hand-maintained in sync with the discriminated `variables`
 * union in the bundled schema; `variablesDiscriminator.test.ts` reads those same
 * branch names, so a drift would surface there.
 */
export type VariableSchemaClass =
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
