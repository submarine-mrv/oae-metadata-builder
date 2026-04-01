// NERC P01 standard identifier options for known variable types.
// Used to auto-populate the standard_identifier field (VocabularyItemReference)
// when creating variables of specific types.

export interface StandardIdentifierOption {
  code: string;
  uri: string;
  term: string;
}

export const STANDARD_IDENTIFIER_OPTIONS: Record<string, StandardIdentifierOption[]> = {
  pH: [
    { code: "PHXXZZXX", uri: "http://vocab.nerc.ac.uk/collection/P01/current/PHXXZZXX/", term: "pH (unspecified scale)" },
    { code: "PHMASSXX", uri: "http://vocab.nerc.ac.uk/collection/P01/current/PHMASSXX/", term: "pH (total scale)" },
  ],
  ta: [
    { code: "ALKYZZXX", uri: "http://vocab.nerc.ac.uk/collection/P01/current/ALKYZZXX/", term: "Total Alkalinity (per volume)" },
    { code: "MDMAP014", uri: "http://vocab.nerc.ac.uk/collection/P01/current/MDMAP014/", term: "Total Alkalinity (per mass)" },
  ],
  dic: [
    { code: "DIC", uri: "https://oae-data-protocol.org/variables/dic", term: "Dissolved Inorganic Carbon" },
  ],
  co2: [
    { code: "PCO2XXXX", uri: "http://vocab.nerc.ac.uk/collection/P01/current/PCO2XXXX/", term: "pCO\u2082 (partial pressure)" },
    { code: "FCO2XXXX", uri: "http://vocab.nerc.ac.uk/collection/P01/current/FCO2XXXX/", term: "fCO\u2082 (fugacity)" },
    { code: "XCO2DRAT", uri: "http://vocab.nerc.ac.uk/collection/P01/current/XCO2DRAT/", term: "xCO\u2082 (atmosphere)" },
    { code: "XCO2WBDY", uri: "http://vocab.nerc.ac.uk/collection/P01/current/XCO2WBDY/", term: "xCO\u2082 (water body)" },
  ],
};

/** Returns true if the variable type has exactly one standard identifier (should be auto-locked) */
export function isLockedIdentifier(variableType: string): boolean {
  const options = STANDARD_IDENTIFIER_OPTIONS[variableType];
  return !!options && options.length === 1;
}

/** Returns the default identifier for single-option types, or undefined */
export function getDefaultIdentifier(variableType: string): StandardIdentifierOption | undefined {
  const options = STANDARD_IDENTIFIER_OPTIONS[variableType];
  return options?.length === 1 ? options[0] : undefined;
}

/** Reverse mapping from schema_class → variable type for UI display */
const SCHEMA_CLASS_TO_VARIABLE_TYPE: Record<string, string> = {
  DiscretePHVariable: "pH",
  ContinuousPHVariable: "pH",
  DiscreteTAVariable: "ta",
  ContinuousTAVariable: "ta",
  DiscreteDICVariable: "dic",
  ContinuousDICVariable: "dic",
  DiscreteCO2Variable: "co2",
  DiscreteSedimentVariable: "sediment",
  ContinuousSedimentVariable: "sediment",
  HPLCVariable: "hplc",
  DiscreteMeasuredVariable: "other",
  ContinuousMeasuredVariable: "other",
  ObservedPropertyVariable: "other",
  CalculatedVariable: "other",
  NonMeasuredVariable: "other",
};

/** Derive the UI variable type from a schema_class name */
export function variableTypeFromSchemaClass(schemaClass: string): string | undefined {
  return SCHEMA_CLASS_TO_VARIABLE_TYPE[schemaClass];
}
