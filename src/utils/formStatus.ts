import type { FormDataRecord } from "@/types/forms";
import { computeCompletion } from "./completionCalculator";
import type { ValidationResult } from "./validation";

export interface FormStatus {
  percentage: number;
  isValid: boolean;
  isEmpty: boolean;
}

const EMPTY_STATUS: FormStatus = { percentage: 0, isValid: false, isEmpty: true };

/** Completion and validity from one validator run. Missing or empty data is 0% and not valid. */
export function formStatus<T extends FormDataRecord>(
  data: T | undefined,
  validate: (data: T) => ValidationResult,
): FormStatus {
  if (!data || Object.keys(data).length === 0) return EMPTY_STATUS;
  // The validator's isValid also covers its exception path, which returns no errors.
  const { errors, isValid } = validate(data);
  return { percentage: computeCompletion(data, errors).percentage, isValid, isEmpty: false };
}
