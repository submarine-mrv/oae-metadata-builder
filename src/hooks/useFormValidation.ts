import { useState, useRef, useCallback, useEffect } from "react";

export type BadgeState =
  | "empty"
  | "missing-only"
  | "missing-and-errors"
  | "errors-only"
  | "passed";

interface UseFormValidationOptions {
  /** Count of AJV errors with name === "required" */
  missingRequired: number;
  /** Count of AJV errors with name !== "required" */
  otherErrors: number;
  /** True when the form has no user-provided values */
  isEmpty: boolean;
  /** Called with true when validation passes, null otherwise */
  onStatusChange?: (passed: boolean | null) => void;
}

interface UseFormValidationReturn {
  /** Derived badge state — drives label, color, icon in ValidationButton */
  badgeState: BadgeState;
  missingRequired: number;
  otherErrors: number;
  /** Whether the top error list is currently displayed */
  showErrorList: boolean;
  /** Ref for the RJSF Form component */
  formRef: React.RefObject<any>;
  /** Click handler for the badge — toggles error list when relevant */
  handleClick: () => void;
}

function deriveBadgeState(
  isEmpty: boolean,
  missingRequired: number,
  otherErrors: number
): BadgeState {
  if (missingRequired === 0 && otherErrors === 0) return "passed";
  if (isEmpty) return "empty";
  if (missingRequired > 0 && otherErrors > 0) return "missing-and-errors";
  if (missingRequired > 0) return "missing-only";
  return "errors-only";
}

/**
 * Hook for passive validation status badge with click-to-show error list.
 *
 * The badge label is derived every render from the three input counts,
 * so it always reflects the current form state without any stored state.
 * Clicking the badge only toggles the grouped error list; it never
 * changes what the badge says.
 *
 * Source of truth: the page runs `validate*()` (AJV) memoized on form data,
 * then filters the result by `err.name === "required"` for the split.
 */
export function useFormValidation({
  missingRequired,
  otherErrors,
  isEmpty,
  onStatusChange
}: UseFormValidationOptions): UseFormValidationReturn {
  const [showErrorList, setShowErrorList] = useState(false);
  const formRef = useRef<any>(null);

  const badgeState = deriveBadgeState(isEmpty, missingRequired, otherErrors);

  // Auto-close the error list once everything passes so the user isn't
  // stuck looking at an empty error list after fixing the last issue.
  useEffect(() => {
    if (badgeState === "passed" && showErrorList) {
      setShowErrorList(false);
    }
  }, [badgeState, showErrorList]);

  // Sync passing state to the app-level validation status (drives overview
  // checkmarks). Anything other than "passed" resets to null.
  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange(badgeState === "passed" ? true : null);
  }, [badgeState, onStatusChange]);

  const handleClick = useCallback(() => {
    // No-op when there's nothing to show
    if (badgeState === "empty" || badgeState === "passed") return;

    setShowErrorList((prev) => {
      const next = !prev;
      // Trigger RJSF validation so inline field errors update to match
      // the new filter state. validateForm() re-runs transformErrors with
      // the new showErrorList value. Defer to next tick so the state
      // update has propagated.
      setTimeout(() => {
        formRef.current?.validateForm?.();
      }, 0);
      return next;
    });
  }, [badgeState]);

  return {
    badgeState,
    missingRequired,
    otherErrors,
    showErrorList,
    formRef,
    handleClick
  };
}
