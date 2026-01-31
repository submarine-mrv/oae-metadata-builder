"use client";

import React, { useState } from "react";
import type { FieldProps } from "@rjsf/utils";
import { Box, PillsInput, Pill } from "@mantine/core";
import { FieldLabelSmall } from "./rjsf/FieldLabel";

/**
 * FilenamesField - A pills-based input for managing a list of filenames.
 * Users can type a filename and press Enter or comma to add it.
 * Similar to RelatedLinksField in ExternalProjectField.
 */
const FilenamesField: React.FC<FieldProps> = (props) => {
  const {
    formData,
    onChange,
    disabled,
    readonly,
    schema,
    name,
    fieldPathId,
    rawErrors
  } = props;

  // Ensure formData is an array
  const values: string[] = Array.isArray(formData) ? formData : [];

  const [search, setSearch] = useState("");

  const handleChange = (newValues: string[]) => {
    onChange(newValues, fieldPathId.path, undefined, fieldPathId.$id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const filename = search.trim();
      if (filename && !values.includes(filename)) {
        handleChange([...values, filename]);
        setSearch("");
      }
    } else if (
      e.key === "Backspace" &&
      search.length === 0 &&
      values.length > 0
    ) {
      handleChange(values.slice(0, -1));
    }
  };

  const handleRemove = (filenameToRemove: string) => {
    handleChange(values.filter((f) => f !== filenameToRemove));
  };

  // Get label from schema title or use the field name
  const label =
    schema.title ||
    name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  // Check if required from parent schema
  const isRequired = props.required;

  return (
    <Box>
      <FieldLabelSmall
        label={label}
        description={schema.description}
        required={isRequired}
      />
      <PillsInput
        error={
          rawErrors && rawErrors.length > 0 ? rawErrors.join(", ") : undefined
        }
      >
        <Pill.Group>
          {values.map((filename, index) => (
            <Pill
              key={index}
              withRemoveButton
              onRemove={() => !(disabled || readonly) && handleRemove(filename)}
            >
              {filename}
            </Pill>
          ))}
          <PillsInput.Field
            placeholder="Type filename and press Enter..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || readonly}
          />
        </Pill.Group>
      </PillsInput>
    </Box>
  );
};

export default FilenamesField;
