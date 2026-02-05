/**
 * LockableIdWidget - Text input with lock/unlock for source ID fields
 *
 * Used for:
 * - Project page: project_id (the source/master project ID)
 * - Experiment page: experiment_id (the source/master experiment ID)
 *
 * Behavior:
 * - Auto-locks when a value is present (prevents accidental edits)
 * - Click unlock icon to edit, auto-locks on blur
 * - Visual feedback: grey background when locked
 */

import React, { useState, useCallback, useEffect } from "react";
import { TextInput } from "@mantine/core";
import { IconLock, IconLockOpen } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps
} from "@rjsf/utils";
import { IdFieldLayout } from "./IdFieldLayout";

interface LockableIdOptions {
  lockOnBlur?: boolean;
  defaultLocked?: boolean;
}

export default function LockableIdWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
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
    uiSchema
  } = props;

  const options = (uiSchema?.["ui:options"] || {}) as LockableIdOptions;
  const lockOnBlur = options.lockOnBlur !== false; // default: true
  const defaultLocked = options.defaultLocked || false;

  // Lock state - start locked if there's a value
  const [isLocked, setIsLocked] = useState(() => (value ? true : defaultLocked));
  const [hasBeenUnlockedManually, setHasBeenUnlockedManually] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-lock when value appears (if not manually unlocked and not focused)
  useEffect(() => {
    if (value && !hasBeenUnlockedManually && !isFocused) {
      setIsLocked(true);
    }
  }, [value, hasBeenUnlockedManually, isFocused]);

  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => {
      if (prev) {
        setHasBeenUnlockedManually(true);
      }
      return !prev;
    });
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (lockOnBlur) {
      setIsLocked(true);
      setHasBeenUnlockedManually(false);
    }
    if (onBlur) {
      onBlur(id, value);
    }
  }, [lockOnBlur, onBlur, id, value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange(newValue === "" ? undefined : newValue);
    },
    [onChange]
  );

  const hasError = rawErrors && rawErrors.length > 0;
  const errorMessage = hasError ? rawErrors.join(", ") : undefined;

  const lockedStyles = {
    input: {
      backgroundColor: "var(--mantine-color-gray-1)",
      color: "var(--mantine-color-gray-6)"
    }
  };

  return (
    <IdFieldLayout
      buttonIcon={isLocked ? <IconLock size={18} /> : <IconLockOpen size={18} />}
      buttonTooltip={isLocked ? "Unlock to edit" : "Lock field"}
      buttonVariant={isLocked ? "light" : "default"}
      buttonAriaLabel={isLocked ? "Unlock field to edit" : "Lock field"}
      onButtonClick={handleToggleLock}
      buttonDisabled={disabled || readonly}
      hasError={hasError}
    >
      <TextInput
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
      />
    </IdFieldLayout>
  );
}
