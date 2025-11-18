import { renderHook } from "@testing-library/react";
import { useInputHandlers } from "../useInputHandlers";

describe("useInputHandlers", () => {
  it("should call onBlur with correct arguments", () => {
    const onBlur = jest.fn();
    const onFocus = jest.fn();
    const { result } = renderHook(() => useInputHandlers("test-id", onBlur, onFocus));

    const mockEvent = {
      target: { value: "test value" }
    } as React.FocusEvent<HTMLInputElement>;

    result.current.handleBlur(mockEvent);

    expect(onBlur).toHaveBeenCalledWith("test-id", "test value");
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("should call onFocus with correct arguments", () => {
    const onBlur = jest.fn();
    const onFocus = jest.fn();
    const { result } = renderHook(() => useInputHandlers("test-id", onBlur, onFocus));

    const mockEvent = {
      target: { value: "test value" }
    } as React.FocusEvent<HTMLInputElement>;

    result.current.handleFocus(mockEvent);

    expect(onFocus).toHaveBeenCalledWith("test-id", "test value");
    expect(onBlur).not.toHaveBeenCalled();
  });

  it("should not throw if onBlur is undefined", () => {
    const { result } = renderHook(() => useInputHandlers("test-id"));

    const mockEvent = {
      target: { value: "test value" }
    } as React.FocusEvent<HTMLInputElement>;

    expect(() => result.current.handleBlur(mockEvent)).not.toThrow();
  });

  it("should not throw if onFocus is undefined", () => {
    const { result } = renderHook(() => useInputHandlers("test-id"));

    const mockEvent = {
      target: { value: "test value" }
    } as React.FocusEvent<HTMLInputElement>;

    expect(() => result.current.handleFocus(mockEvent)).not.toThrow();
  });

  it("should work with textarea elements", () => {
    const onBlur = jest.fn();
    const { result } = renderHook(() => useInputHandlers("test-id", onBlur));

    const mockEvent = {
      target: { value: "textarea value" }
    } as React.FocusEvent<HTMLTextAreaElement>;

    result.current.handleBlur(mockEvent);

    expect(onBlur).toHaveBeenCalledWith("test-id", "textarea value");
  });
});
