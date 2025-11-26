import { useState, useEffect, useCallback } from "react";

export interface UseJsonPreviewOptions {
  minWidth?: number;
  maxWidth?: number;
  initialWidth?: number;
}

export interface UseJsonPreviewReturn {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  width: number;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
}

/**
 * Hook for managing JSON Preview sidebar with keyboard shortcut and resizing
 *
 * Features:
 * - Show/hide with cmd+option+J (Mac) or ctrl+alt+J (Windows/Linux)
 * - Resizable sidebar with configurable width constraints
 * - Mouse event handling for resize dragging
 *
 * @param options - Configuration options for sidebar width
 * @returns State and handlers for JSON Preview sidebar
 */
export function useJsonPreview(
  options: UseJsonPreviewOptions = {}
): UseJsonPreviewReturn {
  const { minWidth = 300, maxWidth = 800, initialWidth = 500 } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);
  const toggle = useCallback(() => setIsVisible((prev) => !prev), []);

  // Handle keyboard shortcut: cmd+option+J (Mac) or ctrl+alt+J (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  // Prevent text selection during resize
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return {
    isVisible,
    show,
    hide,
    toggle,
    width,
    isResizing,
    setIsResizing
  };
}
