"use client";

import React, { useState, useEffect } from "react";
import { Box, Group, Text, Button } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useAppState } from "@/contexts/AppStateContext";

interface JsonPreviewSidebarProps {
  /** The data object to display as JSON */
  data: unknown;
}

const DEFAULT_WIDTH = 500;
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;

/**
 * A resizable sidebar that displays JSON data.
 * Visibility is controlled via AppStateContext (showJsonPreview).
 */
export default function JsonPreviewSidebar({ data }: JsonPreviewSidebarProps) {
  const { state, setShowJsonPreview } = useAppState();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringHandle, setIsHoveringHandle] = useState(false);

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
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
  }, [isResizing]);

  if (!state.showJsonPreview) {
    return null;
  }

  return (
    <Box
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        backgroundColor: "var(--mantine-color-gray-0)",
        borderLeft: "1px solid var(--mantine-color-gray-3)",
        display: "flex",
        flexDirection: "column",
        position: "relative"
      }}
    >
      {/* Resize handle */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 4,
          height: "100%",
          backgroundColor:
            isResizing || isHoveringHandle
              ? "var(--mantine-color-gray-4)"
              : "transparent",
          cursor: "col-resize",
          transition: "background-color 150ms ease"
        }}
        onMouseDown={() => setIsResizing(true)}
        onMouseEnter={() => setIsHoveringHandle(true)}
        onMouseLeave={() => setIsHoveringHandle(false)}
      />

      {/* Header */}
      <Group
        justify="space-between"
        align="center"
        p="md"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
      >
        <Text fw={600}>JSON Preview</Text>
        <Button
          variant="subtle"
          size="xs"
          aria-label="Close JSON preview"
          onClick={() => setShowJsonPreview(false)}
        >
          <IconX size={16} />
        </Button>
      </Group>

      {/* Content */}
      <Box style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        <pre
          style={{
            fontSize: "0.8rem",
            margin: 0,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </Box>
    </Box>
  );
}
