import { renderHook, act } from "@testing-library/react";
import { useResizer } from "../useResizer";

describe("useResizer", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => useResizer());

    expect(result.current.width).toBe(500);
    expect(result.current.isResizing).toBe(false);
  });

  it("should initialize with custom values", () => {
    const { result } = renderHook(() =>
      useResizer({ initialWidth: 600, minWidth: 200, maxWidth: 900 })
    );

    expect(result.current.width).toBe(600);
    expect(result.current.isResizing).toBe(false);
  });

  it("should update isResizing state", () => {
    const { result } = renderHook(() => useResizer());

    act(() => {
      result.current.setIsResizing(true);
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      result.current.setIsResizing(false);
    });

    expect(result.current.isResizing).toBe(false);
  });

  it("should respect min and max width constraints", () => {
    const { result } = renderHook(() =>
      useResizer({ minWidth: 300, maxWidth: 800, initialWidth: 500 })
    );

    // Start resizing
    act(() => {
      result.current.setIsResizing(true);
    });

    // Simulate mouse move that would result in width below min
    act(() => {
      const event = new MouseEvent("mousemove", { clientX: window.innerWidth - 200 });
      document.dispatchEvent(event);
    });

    // Width should be clamped to minWidth
    expect(result.current.width).toBeGreaterThanOrEqual(300);

    // Simulate mouse move that would result in width above max
    act(() => {
      const event = new MouseEvent("mousemove", { clientX: window.innerWidth - 1000 });
      document.dispatchEvent(event);
    });

    // Width should be clamped to maxWidth
    expect(result.current.width).toBeLessThanOrEqual(800);
  });
});
