/**
 * LinkedIdWidget - Configurable widget for project_id and experiment_id fields
 *
 * Provides lock/unlock functionality with optional dropdown selection for linked IDs.
 * Used across Project, Experiment, and Dataset pages with different modes:
 * - "simple": Text input with lock/unlock (for defining the ID, e.g., project_id on Project page)
 * - "project": Dropdown showing available projects with "Custom" option for manual entry
 * - "experiment": Dropdown showing available experiments with "Custom" option for manual entry
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  TextInput,
  Select,
  ActionIcon,
  Group,
  Text,
  Box,
  ComboboxItem,
  Menu
} from "@mantine/core";
import { IconLock, IconLockOpen, IconSelector } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps
} from "@rjsf/utils";
import { useAppState } from "@/contexts/AppStateContext";

// Custom option for manual entry
const CUSTOM_OPTION_VALUE = "__custom__";

type LinkedIdMode = "simple" | "project" | "experiment";

interface LinkedIdOptions {
  mode?: LinkedIdMode;
  lockOnBlur?: boolean;
  defaultLocked?: boolean;
}

export default function LinkedIdWidget<
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

  const { state } = useAppState();

  // Extract options from uiSchema
  const options = (uiSchema?.["ui:options"] || {}) as LinkedIdOptions;
  const mode: LinkedIdMode = options.mode || "simple";
  const lockOnBlur = options.lockOnBlur !== false; // default: true
  const defaultLocked = options.defaultLocked || false;

  // State - lock by default if value exists
  const [isLocked, setIsLocked] = useState(() => {
    // If value exists, start locked; otherwise use defaultLocked setting
    return value ? true : defaultLocked;
  });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [hasBeenUnlockedManually, setHasBeenUnlockedManually] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Build dropdown options based on mode
  const dropdownOptions = useMemo((): ComboboxItem[] => {
    const items: ComboboxItem[] = [];

    if (mode === "project") {
      // Get project from state
      const projectId = state.projectData?.project_id;
      const projectName = state.projectData?.research_project as string | undefined;

      if (projectId) {
        items.push({
          value: projectId,
          label: projectName || projectId
        });
      }
    } else if (mode === "experiment") {
      // Get experiments from state
      for (const exp of state.experiments) {
        const expId = exp.formData?.experiment_id as string | undefined;
        const expName = exp.name || (exp.formData?.name as string | undefined);

        if (expId) {
          items.push({
            value: expId,
            label: expName || expId
          });
        }
      }
    }

    // Always add "Custom" option at the end
    items.push({
      value: CUSTOM_OPTION_VALUE,
      label: "Custom"
    });

    return items;
  }, [mode, state.projectData, state.experiments]);

  // Check if current value exists in dropdown options
  const valueExistsInOptions = useMemo(() => {
    if (mode === "simple") return true;
    return dropdownOptions.some(
      (opt) => opt.value === value && opt.value !== CUSTOM_OPTION_VALUE
    );
  }, [mode, dropdownOptions, value]);

  // Initialize custom mode if value doesn't exist in options
  useEffect(() => {
    if (mode !== "simple" && value && !valueExistsInOptions) {
      setIsCustomMode(true);
    }
  }, [mode, value, valueExistsInOptions]);

  // Auto-lock when value appears (e.g., project_id populated from state)
  // Only if user hasn't manually unlocked the field AND field is not focused
  // This prevents locking while the user is actively typing
  useEffect(() => {
    if (value && !hasBeenUnlockedManually && !isFocused) {
      setIsLocked(true);
    }
  }, [value, hasBeenUnlockedManually, isFocused]);

  // Handle toggle lock
  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => {
      if (prev) {
        // User is unlocking - track this so we don't auto-lock again
        setHasBeenUnlockedManually(true);
      }
      return !prev;
    });
  }, []);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur - auto-lock if enabled
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (lockOnBlur) {
      setIsLocked(true);
      // Reset the manual unlock flag since we're locking on blur
      setHasBeenUnlockedManually(false);
    }
    if (onBlur) {
      onBlur(id, value);
    }
  }, [lockOnBlur, onBlur, id, value]);

  // Handle text input change (simple mode or custom mode)
  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange(newValue === "" ? undefined : newValue);
    },
    [onChange]
  );

  // Handle dropdown selection
  const handleSelectChange = useCallback(
    (selectedValue: string | null) => {
      if (selectedValue === CUSTOM_OPTION_VALUE) {
        // Switch to custom mode
        setIsCustomMode(true);
        onChange(undefined);
      } else {
        // Use selected value
        setIsCustomMode(false);
        onChange(selectedValue || undefined);
      }
    },
    [onChange]
  );

  // Render lock button (outside input, more button-like)
  const renderLockButton = (alignWithError = false) => (
    <ActionIcon
      variant={isLocked ? "light" : "default"}
      size="lg"
      onClick={handleToggleLock}
      disabled={disabled || readonly}
      aria-label={isLocked ? "Unlock field to edit" : "Lock field"}
      title={isLocked ? "Click to unlock and edit" : "Click to lock"}
      mb={alignWithError ? 0 : 0}
    >
      {isLocked ? <IconLock size={18} /> : <IconLockOpen size={18} />}
    </ActionIcon>
  );

  // Render label with optional asterisk
  const renderLabel = () => {
    if (hideLabel) return undefined;
    return label;
  };

  // Custom render for dropdown options with name + id display
  const renderSelectOption = ({ option }: { option: ComboboxItem }) => {
    if (option.value === CUSTOM_OPTION_VALUE) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          Custom (enter manually)
        </Text>
      );
    }

    // For project/experiment options, show name with ID below
    const displayLabel = option.label || option.value;
    const displayId = option.value;
    const showId = displayLabel !== displayId;

    return (
      <Box>
        <Text size="sm">{displayLabel}</Text>
        {showId && (
          <Text size="xs" c="dimmed">
            {displayId}
          </Text>
        )}
      </Box>
    );
  };

  // Determine what to render based on mode and state
  const hasError = rawErrors && rawErrors.length > 0;
  const errorMessage = hasError ? rawErrors.join(", ") : undefined;

  // Locked input styles - grey background and text
  const lockedInputStyles = {
    input: {
      backgroundColor: "var(--mantine-color-gray-1)",
      color: "var(--mantine-color-gray-6)"
    }
  };

  // Simple mode: always show text input with lock button outside
  if (mode === "simple") {
    return (
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          id={id}
          label={renderLabel()}
          placeholder={placeholder}
          value={value || ""}
          required={required}
          disabled={disabled}
          readOnly={readonly || isLocked}
          error={errorMessage}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ flex: 1 }}
          styles={isLocked ? lockedInputStyles : undefined}
        />
        <Box mb={hasError ? 22 : 0}>{renderLockButton()}</Box>
      </Group>
    );
  }

  // Project or Experiment mode: show dropdown or custom text input
  if (isLocked) {
    // Locked state: show read-only text input with lock button outside
    return (
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          id={id}
          label={renderLabel()}
          value={value || ""}
          required={required}
          disabled={disabled}
          readOnly
          error={errorMessage}
          style={{ flex: 1 }}
          styles={lockedInputStyles}
        />
        <Box mb={hasError ? 22 : 0}>{renderLockButton()}</Box>
      </Group>
    );
  }

  if (isCustomMode) {
    // Custom mode: show text input with lock button and dropdown menu button
    return (
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          id={id}
          label={renderLabel()}
          placeholder={placeholder || "Enter ID manually"}
          value={value || ""}
          required={required}
          disabled={disabled}
          readOnly={readonly}
          error={errorMessage}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ flex: 1 }}
        />
        <Box mb={hasError ? 22 : 0}>
          <Group gap={4} wrap="nowrap">
            {renderLockButton()}
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="default"
                  size="lg"
                  title="Select from existing"
                  aria-label="Select from existing options"
                >
                  <IconSelector size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {dropdownOptions
                  .filter((opt) => opt.value !== CUSTOM_OPTION_VALUE)
                  .map((opt) => (
                    <Menu.Item
                      key={opt.value}
                      onClick={() => {
                        setIsCustomMode(false);
                        onChange(opt.value);
                      }}
                    >
                      <Box>
                        <Text size="sm">{opt.label}</Text>
                        {opt.label !== opt.value && (
                          <Text size="xs" c="dimmed">
                            {opt.value}
                          </Text>
                        )}
                      </Box>
                    </Menu.Item>
                  ))}
                {dropdownOptions.filter((opt) => opt.value !== CUSTOM_OPTION_VALUE)
                  .length > 0 && <Menu.Divider />}
                <Menu.Item
                  onClick={() => {
                    // Stay in custom mode, keep current value
                  }}
                  c="dimmed"
                  fs="italic"
                >
                  Custom (current)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Box>
      </Group>
    );
  }

  // Default: show dropdown with lock button outside
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Select
        id={id}
        label={renderLabel()}
        placeholder={placeholder || "Select or enter custom"}
        value={value || null}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        error={errorMessage}
        data={dropdownOptions}
        onChange={handleSelectChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        renderOption={renderSelectOption}
        allowDeselect={false}
        style={{ flex: 1 }}
      />
      <Box mb={hasError ? 22 : 0}>{renderLockButton()}</Box>
    </Group>
  );
}
