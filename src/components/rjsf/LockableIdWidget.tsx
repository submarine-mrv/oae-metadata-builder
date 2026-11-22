/**
 * LockableIdWidget - Text input with inline pencil icon for source ID fields
 *
 * Used for:
 * - Project page: project_id (the source/master project ID)
 * - Experiment page: experiment_id (the source/master experiment ID)
 *
 * Behavior:
 * - Auto-locks when a value is present (prevents accidental edits)
 * - When locked: dimmed input with pencil icon inside (right section)
 * - Click pencil to unlock and edit; pencil disappears while editing
 * - Auto-locks on blur, pencil reappears, input dims again
 * - Leaving the field with an ID that fails the schema pattern restores the ID it had on focus
 */

import { ActionIcon, Box, Text, TextInput, Tooltip } from "@mantine/core";
import type { FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from "@rjsf/utils";
import { IconInfoCircle, IconPencil } from "@tabler/icons-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import DescriptionModal from "./DescriptionModal";

function matchesPattern(value: unknown, pattern: string | undefined): boolean {
  return !value || !pattern || new RegExp(pattern, "u").test(String(value));
}

interface LockableIdOptions {
  lockOnBlur?: boolean;
  defaultLocked?: boolean;
}

export default function LockableIdWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any,
>(props: WidgetProps<T, S, F>) {
  const {
    id,
    value,
    placeholder,
    required,
    disabled,
    readonly,
    label,
    hideLabel,
    rawErrors,
    onChange,
    onBlur,
    schema,
    uiSchema,
  } = props;

  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;
  const [modalOpened, setModalOpened] = useState(false);

  const options = (uiSchema?.["ui:options"] || {}) as LockableIdOptions;
  const lockOnBlur = options.lockOnBlur !== false; // default: true
  const defaultLocked = options.defaultLocked || false;

  const inputRef = useRef<HTMLInputElement>(null);
  const valueOnFocus = useRef(value);
  const isValid = matchesPattern(value, schema?.pattern);

  // Lock state - start locked if there's a value
  const [isLocked, setIsLocked] = useState(() => (value && isValid ? true : defaultLocked));
  const [hasBeenUnlockedManually, setHasBeenUnlockedManually] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-lock when value appears (if not manually unlocked and not focused)
  useEffect(() => {
    if (value && isValid && !hasBeenUnlockedManually && !isFocused) {
      setIsLocked(true);
    }
  }, [value, isValid, hasBeenUnlockedManually, isFocused]);

  const handlePencilClick = useCallback(() => {
    setIsLocked(false);
    setHasBeenUnlockedManually(true);
    // Focus the input after unlocking
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    valueOnFocus.current = value;
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    let kept = value;
    if (!isValid && value !== valueOnFocus.current) {
      kept = valueOnFocus.current;
      onChange(kept);
    }
    // An ID imported before the pattern existed stays editable until it is fixed.
    if (lockOnBlur && kept && matchesPattern(kept, schema?.pattern)) {
      setIsLocked(true);
      setHasBeenUnlockedManually(false);
    }
    if (onBlur) {
      onBlur(id, kept);
    }
  }, [lockOnBlur, onBlur, onChange, id, value, isValid, schema?.pattern]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange(newValue === "" ? undefined : newValue);
    },
    [onChange],
  );

  const hasError = rawErrors && rawErrors.length > 0;
  const errorMessage = hasError ? rawErrors.join(", ") : undefined;

  const lockedStyles = {
    input: {
      backgroundColor: "var(--mantine-color-gray-1)",
      color: "var(--mantine-color-gray-6)",
    },
  };

  return (
    <>
      <Box style={{ position: "relative" }}>
        <TextInput
          ref={inputRef}
          id={id}
          label={hideLabel ? undefined : label}
          placeholder={placeholder}
          value={value || ""}
          required={required}
          disabled={disabled}
          readOnly={readonly || isLocked}
          error={errorMessage}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          styles={isLocked ? lockedStyles : undefined}
          rightSection={
            isLocked && !disabled && !readonly ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={handlePencilClick}
                aria-label="Click to edit"
              >
                <IconPencil size={16} />
              </ActionIcon>
            ) : undefined
          }
        />
        {description && !hideLabel && (
          <Box
            style={{
              position: "absolute",
              top: "2px",
              left: "0",
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <Text
              size="sm"
              fw={500}
              style={{
                visibility: "hidden",
                marginRight: "4px",
              }}
            >
              {label}
              {required && " *"}
            </Text>
            <Box style={{ pointerEvents: "auto" }}>
              {useModal ? (
                <ActionIcon
                  variant="transparent"
                  size="xs"
                  color="gray"
                  onClick={() => setModalOpened(true)}
                  style={{ cursor: "pointer" }}
                >
                  <IconInfoCircle size={14} />
                </ActionIcon>
              ) : (
                <Tooltip label={description} maw={400}>
                  <ActionIcon variant="transparent" size="xs" color="gray">
                    <IconInfoCircle size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {useModal && description && (
        <DescriptionModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title={label}
          description={description}
        />
      )}
    </>
  );
}
