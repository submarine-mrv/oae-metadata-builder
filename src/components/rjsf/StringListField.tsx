"use client";

import React, { useState } from "react";
import type { FieldProps } from "@rjsf/utils";
import { ActionIcon, Box, Group, Text, TextInput } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { FieldLabelSmall } from "./FieldLabel";

/**
 * StringListField — a lightweight list manager for arrays of strings
 * (URLs, filenames, references, config links).
 *
 * Type freely, press Enter or Tab to add. Each item renders as a row
 * with a remove button. Cleaner than pills for long strings like URLs.
 *
 * Supports ui:options:
 * - placeholder: input placeholder (default: "Type and press Enter to add")
 */
const StringListField: React.FC<FieldProps> = (props) => {
  const {
    formData,
    onChange,
    disabled,
    readonly,
    schema,
    uiSchema,
    name,
    fieldPathId
  } = props;

  const items: string[] = Array.isArray(formData) ? formData : [];
  const [input, setInput] = useState("");

  const uiOptions = (uiSchema?.["ui:options"] ?? {}) as Record<string, any>;
  const placeholder = uiOptions.placeholder ?? "Type and press Enter to add";

  const label =
    (uiSchema?.["ui:title"] as string) ||
    schema.title ||
    name
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const isRequired = props.required;
  const isEditable = !disabled && !readonly;

  const handleChange = (newValues: string[]) => {
    onChange(newValues, fieldPathId.path, undefined, fieldPathId.$id);
  };

  const addItem = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      handleChange([...items, trimmed]);
      setInput("");
    }
  };

  const removeItem = (index: number) => {
    handleChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    } else if (e.key === "Tab" && input.trim()) {
      e.preventDefault();
      addItem();
    } else if (
      e.key === "Backspace" &&
      input.length === 0 &&
      items.length > 0
    ) {
      removeItem(items.length - 1);
    }
  };

  return (
    <Box>
      <FieldLabelSmall
        label={label}
        description={schema.description}
        required={isRequired}
      />

      {/* Item list */}
      {items.length > 0 && (
        <Box
          style={{
            border: "1px solid var(--mantine-color-gray-3)",
            borderRadius: "var(--mantine-radius-sm)",
            overflow: "hidden",
            marginBottom: 8
          }}
        >
          {items.map((item, index) => (
            <Group
              key={index}
              justify="space-between"
              wrap="nowrap"
              gap="xs"
              px="sm"
              py={6}
              style={{
                borderBottom:
                  index < items.length - 1
                    ? "1px solid var(--mantine-color-gray-2)"
                    : undefined,
                minHeight: 36
              }}
            >
              <Text
                size="sm"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--mantine-font-family-monospace)",
                  fontSize: 13
                }}
                title={item}
              >
                {item}
              </Text>
              {isEditable && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove ${item}`}
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>
          ))}
        </Box>
      )}

      {/* Input row */}
      {isEditable && (
        <TextInput
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addItem();
          }}
          size="sm"
          rightSection={
            input.trim() ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={addItem}
                aria-label="Add item"
              >
                <IconPlus size={14} />
              </ActionIcon>
            ) : undefined
          }
        />
      )}
    </Box>
  );
};

export default StringListField;
