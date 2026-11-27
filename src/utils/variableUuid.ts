import { isUuid } from "./stableUuid";

/**
 * Key of a variable's stable identity inside a dataset's `variables`. It lets concurrent edits
 * merge per variable rather than per list. The published protocol has no such field, so
 * exports and publications strip it.
 */
export const VARIABLE_UUID = "_uuid";

type WithVariables = { variables?: unknown };

const variableList = (formData: WithVariables) =>
  Array.isArray(formData.variables) ? (formData.variables as unknown[]) : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function variableUuid(variable: unknown): string | undefined {
  return isRecord(variable) && isUuid(variable[VARIABLE_UUID])
    ? (variable[VARIABLE_UUID] as string)
    : undefined;
}

/** Gives every variable without a UUID the one `mint` returns for its position. */
export function withVariableUuids<T extends WithVariables>(
  formData: T,
  mint: (index: number) => string = () => crypto.randomUUID(),
): T {
  const variables = variableList(formData);
  if (!variables?.some((variable) => isRecord(variable) && !variableUuid(variable))) {
    return formData;
  }
  return {
    ...formData,
    variables: variables.map((variable, index) =>
      isRecord(variable) && !variableUuid(variable)
        ? { ...variable, [VARIABLE_UUID]: mint(index) }
        : variable,
    ),
  };
}

/** The form data without variable UUIDs, as the published protocol defines it. */
export function withoutVariableUuids<T extends WithVariables>(formData: T): T {
  const variables = variableList(formData);
  if (!variables?.some((variable) => isRecord(variable) && VARIABLE_UUID in variable)) {
    return formData;
  }
  return {
    ...formData,
    variables: variables.map((variable) => {
      if (!isRecord(variable)) return variable;
      const { [VARIABLE_UUID]: _, ...rest } = variable;
      return rest;
    }),
  };
}
