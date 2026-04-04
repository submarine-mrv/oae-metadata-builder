import { useState, useRef, useCallback } from "react";

interface ValidationResult {
  errorCount: number;
}

interface UseFormValidationOptions {
  /** Function that validates the data and returns error count */
  validate: () => ValidationResult;
  /** Called when validation status changes (for persisting to context) */
  onStatusChange?: (status: boolean | null) => void;
}

interface UseFormValidationReturn {
  /** Whether RJSF should show the error list at top */
  showErrorList: boolean;
  /** Validation status: null = not yet run, true = passed, false = failed */
  validationPassed: boolean | null;
  /** Ref for the RJSF Form component */
  formRef: React.RefObject<any>;
  /** Run validation — shows errors or checkmark */
  runValidation: () => void;
  /** Reset validation state (call on form change) */
  resetValidation: () => void;
}

/**
 * Hook for form validation with visual feedback.
 *
 * - "Validate Metadata" button calls runValidation()
 * - If all valid: sets validationPassed = true (shows checkmark)
 * - If errors: triggers RJSF error list display
 * - Any form edit calls resetValidation() to clear the checkmark
 */
export function useFormValidation({
  validate,
  onStatusChange
}: UseFormValidationOptions): UseFormValidationReturn {
  const [showErrorList, setShowErrorList] = useState(false);
  const [validationPassed, setValidationPassed] = useState<boolean | null>(null);

  const formRef = useRef<any>(null);

  const runValidation = useCallback(() => {
    const result = validate();

    if (result.errorCount === 0) {
      setShowErrorList(false);
      setValidationPassed(true);
      onStatusChange?.(true);
    } else {
      setValidationPassed(false);
      onStatusChange?.(false);
      setShowErrorList(true);

      // Trigger RJSF validation to populate the error list and inline errors
      formRef.current?.submit();
    }
  }, [validate, onStatusChange]);

  const resetValidation = useCallback(() => {
    setValidationPassed(null);
    setShowErrorList(false);
    onStatusChange?.(null);
  }, [onStatusChange]);

  return {
    showErrorList,
    validationPassed,
    formRef,
    runValidation,
    resetValidation
  };
}