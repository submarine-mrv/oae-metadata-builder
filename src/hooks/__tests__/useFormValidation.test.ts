// useFormValidation.test.ts - Tests for the validation badge hook

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormValidation } from "../useFormValidation";

describe("useFormValidation", () => {
  describe("deriveBadgeState via the hook", () => {
    it("returns 'passed' when no errors", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: false
        })
      );
      expect(result.current.badgeState).toBe("passed");
    });

    it("returns 'passed' even when form is also empty", () => {
      // A schema with no required fields and an empty form is still valid.
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: true
        })
      );
      expect(result.current.badgeState).toBe("passed");
    });

    it("returns 'empty' when form empty and required fields missing", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 3,
          otherErrors: 0,
          isEmpty: true
        })
      );
      expect(result.current.badgeState).toBe("empty");
    });

    it("does NOT return 'empty' when there are non-required errors", () => {
      // Regression test for roborev job 173: an empty form with
      // non-required errors should still be clickable, otherwise the
      // user has no way to open the error list.
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 3,
          otherErrors: 1,
          isEmpty: true
        })
      );
      expect(result.current.badgeState).toBe("missing-and-errors");
    });

    it("returns 'missing-only' when only required errors and not empty", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false
        })
      );
      expect(result.current.badgeState).toBe("missing-only");
    });

    it("returns 'errors-only' when only non-required errors", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 1,
          isEmpty: false
        })
      );
      expect(result.current.badgeState).toBe("errors-only");
    });

    it("returns 'missing-and-errors' when both present", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 1,
          isEmpty: false
        })
      );
      expect(result.current.badgeState).toBe("missing-and-errors");
    });
  });

  describe("handleClick", () => {
    it("is a no-op when badgeState is 'empty'", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 3,
          otherErrors: 0,
          isEmpty: true
        })
      );
      expect(result.current.showErrorList).toBe(false);
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(false);
    });

    it("is a no-op when badgeState is 'passed'", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: false
        })
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(false);
    });

    it("opens the error list when badgeState is 'missing-only'", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false
        })
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);
    });

    it("opens the error list when badgeState is 'errors-only'", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 1,
          isEmpty: false
        })
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);
    });

    it("is a no-op when already open", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false
        })
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true); // still open
    });
  });

  describe("closeErrorList", () => {
    it("closes the error list when open", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false
        })
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);
      act(() => {
        result.current.closeErrorList();
      });
      expect(result.current.showErrorList).toBe(false);
    });
  });

  describe("onStatusChange", () => {
    it("fires with true when state is 'passed' on mount", () => {
      const onStatusChange = vi.fn();
      renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: false,
          onStatusChange
        })
      );
      expect(onStatusChange).toHaveBeenCalledWith(true);
    });

    it("fires with null when state is not 'passed' on mount", () => {
      const onStatusChange = vi.fn();
      renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false,
          onStatusChange
        })
      );
      expect(onStatusChange).toHaveBeenCalledWith(null);
    });

    it("fires on badge state transitions", () => {
      const onStatusChange = vi.fn();
      const { rerender } = renderHook(
        ({ missing }: { missing: number }) =>
          useFormValidation({
            missingRequired: missing,
            otherErrors: 0,
            isEmpty: false,
            onStatusChange
          }),
        { initialProps: { missing: 2 } }
      );
      expect(onStatusChange).toHaveBeenLastCalledWith(null);

      // Transition to passed
      rerender({ missing: 0 });
      expect(onStatusChange).toHaveBeenLastCalledWith(true);

      // Transition back
      rerender({ missing: 1 });
      expect(onStatusChange).toHaveBeenLastCalledWith(null);
    });

    it("auto-closes error list when transitioning to 'passed'", () => {
      const { result, rerender } = renderHook(
        ({ missing }: { missing: number }) =>
          useFormValidation({
            missingRequired: missing,
            otherErrors: 0,
            isEmpty: false
          }),
        { initialProps: { missing: 2 } }
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);

      // Transition to passed
      rerender({ missing: 0 });
      expect(result.current.showErrorList).toBe(false);
      expect(result.current.badgeState).toBe("passed");
    });
  });
});
