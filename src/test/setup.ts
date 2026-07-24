import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.URL
globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
globalThis.URL.revokeObjectURL = vi.fn();

// Mock window.scrollTo
globalThis.scrollTo = vi.fn();

// Mock ResizeObserver (required for Mantine Select/Combobox components)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver as any;

// Mock window.matchMedia (required for Mantine components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.addEventListener (for some components)
const originalAddEventListener = window.addEventListener;
window.addEventListener = vi.fn((event, handler, options) => {
  if (typeof handler === "function") {
    originalAddEventListener(event, handler, options);
  }
});

// Suppress console errors in tests (optional - remove if you want to see them)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("useAppState must be used within") ||
        args[0].includes("Not implemented: navigation"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock Blob constructor for downloads
class MockBlob {
  parts: any[];
  options: any;

  constructor(parts: any[], options?: any) {
    this.parts = parts;
    this.options = options;
  }

  get type() {
    return this.options?.type || "";
  }
}

globalThis.Blob = vi.fn((parts: any[], options?: any) => new MockBlob(parts, options)) as any;
