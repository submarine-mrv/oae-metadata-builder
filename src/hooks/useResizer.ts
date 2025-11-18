import { useState, useEffect } from "react";

interface ResizerOptions {
  minWidth?: number;
  maxWidth?: number;
  initialWidth?: number;
}

interface UseResizerReturn {
  width: number;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
}

export function useResizer(options: ResizerOptions = {}): UseResizerReturn {
  const { minWidth = 300, maxWidth = 800, initialWidth = 500 } = options;
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
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

  return { width, isResizing, setIsResizing };
}
