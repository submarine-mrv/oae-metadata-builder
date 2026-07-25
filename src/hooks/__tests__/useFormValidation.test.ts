// useFormValidation.test.ts - Tests for the validation badge hook

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFormValidation } from "../useFormValidation";

describe("useFormValidation", () => {
  describe("deriveBadgeState via the hook", () => {
    it("returns 'passed' when no errors", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: false,
        }),
      );
      expect(result.current.badgeState).toBe("passed");
    });

    it("returns 'passed' even when form is also empty", () => {
      // A schema with no required fields and an empty form is still valid.
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 0,
          isEmpty: true,
        }),
      );
      expect(result.current.badgeState).toBe("passed");
    });

    it("returns 'empty' when form empty and required fields missing", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 3,
          otherErrors: 0,
          isEmpty: true,
        }),
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
          isEmpty: true,
        }),
      );
      expect(result.current.badgeState).toBe("missing-and-errors");
    });

    it("returns 'missing-only' when only required errors and not empty", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 0,
          isEmpty: false,
        }),
      );
      expect(result.current.badgeState).toBe("missing-only");
    });

    it("returns 'errors-only' when only non-required errors", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 0,
          otherErrors: 1,
          isEmpty: false,
        }),
      );
      expect(result.current.badgeState).toBe("errors-only");
    });

    it("returns 'missing-and-errors' when both present", () => {
      const { result } = renderHook(() =>
        useFormValidation({
          missingRequired: 2,
          otherErrors: 1,
          isEmpty: false,
        }),
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
          isEmpty: true,
        }),
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
          isEmpty: false,
        }),
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
          isEmpty: false,
        }),
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
          isEmpty: false,
        }),
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
          isEmpty: false,
        }),
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
          isEmpty: false,
        }),
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

  describe("error list auto-close", () => {
    it("closes the open error list when validation transitions to 'passed'", () => {
      const { result, rerender } = renderHook(
        (props: { missingRequired: number; otherErrors: number; isEmpty: boolean }) =>
          useFormValidation(props),
        { initialProps: { missingRequired: 2, otherErrors: 0, isEmpty: false } },
      );
      act(() => {
        result.current.handleClick();
      });
      expect(result.current.showErrorList).toBe(true);

      // Fixing the last issue flips badgeState to "passed" — the hook
      // auto-closes the list so the user isn't stuck on an empty panel.
      rerender({ missingRequired: 0, otherErrors: 0, isEmpty: false });
      expect(result.current.badgeState).toBe("passed");
      expect(result.current.showErrorList).toBe(false);
    });
  });
});
