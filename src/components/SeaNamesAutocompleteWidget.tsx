"use client";
import React from "react";
import type { WidgetProps } from "@rjsf/utils";
import MultiSelectPillWidget from "./rjsf/MultiSelectPillWidget";

/**
 * Sea Names multi-select widget — thin wrapper around MultiSelectPillWidget
 * with sea-names-specific defaults.
 */
const SeaNamesAutocompleteWidget: React.FC<WidgetProps> = (props) => {
  const options = {
    ...props.options,
    placeholder: (props.options as any)?.placeholder ?? "Search seas…",
    emptyMessage: (
      <>
        Nothing found.{" "}
        <a
          href="https://vocab.nerc.ac.uk/collection/C16/current/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--mantine-color-blue-6)",
            textDecoration: "underline"
          }}
        >
          View all sea names
        </a>
      </>
    )
  };

  return <MultiSelectPillWidget {...props} options={options} />;
};

export default SeaNamesAutocompleteWidget;
