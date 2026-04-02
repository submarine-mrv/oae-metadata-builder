import { useState, useRef, useCallback } from "react";

interface ValidationResult {
  errorCount: number;
}

interface UseFormValidationOptions {
  /** Function that validates the data and returns error count */
  validate: () => ValidationResult;
}

interface UseFormValidationReturn {
  /** Whether RJSF should show the error list at top */
  showErrorList: boolean;
  /** Validation status: null = not yet run, true = passed, false = failed */
  validationPassed: boolean | null;
  /** Ref for the RJSF Form component */
  formRef: React.RefObject<any>;
  /** Ref for the scrollable container div */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Run validation — shows errors or checkmark */
  runValidation: () => void;
  /** Reset validation state (call on form change) */
  resetValidation: () => void;
}

/**
 * Hook for form validation with visual feedback.
 *
 * - "Run Validation" button calls runValidation()
 * - If all valid: sets validationPassed = true (shows checkmark)
 * - If errors: triggers RJSF error list and scrolls to first error
 * - Any form edit calls resetValidation() to clear the checkmark
 */
export function useFormValidation({
  validate
}: UseFormValidationOptions): UseFormValidationReturn {
  const [showErrorList, setShowErrorList] = useState(false);
  const [validationPassed, setValidationPassed] = useState<boolean | null>(null);

  const formRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const runValidation = useCallback(() => {
    const result = validate();

    if (result.errorCount === 0) {
      setShowErrorList(false);
      setValidationPassed(true);
    } else {
      setValidationPassed(false);
      setShowErrorList(true);

      // Trigger RJSF validation to show the error list
      const formElement = scrollContainerRef.current?.querySelector("form") as HTMLFormElement | null;
      const html5Valid = formElement?.reportValidity() ?? true;

      if (html5Valid && formRef.current) {
        formRef.current.submit();
      }

      // Scroll to top where errors are displayed
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [validate]);

  const resetValidation = useCallback(() => {
    setValidationPassed(null);
    setShowErrorList(false);
  }, []);

  return {
    showErrorList,
    validationPassed,
    formRef,
    scrollContainerRef,
    runValidation,
    resetValidation
  };
}