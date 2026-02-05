/**
 * LinkedIdWidget - Configurable widget for project_id and experiment_id fields
 *
 * Provides different behaviors based on mode:
 * - "simple": Text input with Lock/Unlock (for source IDs - project_id on Project, experiment_id on Experiment)
 * - "project": Link/Unlink toggle for project_id inheritance (on Experiment/Dataset pages)
 * - "experiment": Link/Unlink with dropdown for experiment selection (on Dataset pages)
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  TextInput,
  Select,
  ActionIcon,
  Group,
  Box,
  ComboboxItem,
  Tooltip
} from "@mantine/core";
import {
  IconLock,
  IconLockOpen,
  IconLink,
  IconLinkOff
} from "@tabler/icons-react";
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
  entityType?: "experiment" | "dataset";
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

  const { state, updateExperimentLinking, updateDatasetLinking } =
    useAppState();

  // Extract options from uiSchema
  const options = (uiSchema?.["ui:options"] || {}) as LinkedIdOptions;
  const mode: LinkedIdMode = options.mode || "simple";
  const entityType = options.entityType;
  const lockOnBlur = options.lockOnBlur !== false; // default: true
  const defaultLocked = options.defaultLocked || false;

  // Get entityInternalId from state based on entityType
  const entityInternalId = useMemo(() => {
    if (entityType === "experiment") {
      return state.activeExperimentId ?? undefined;
    } else if (entityType === "dataset") {
      return state.activeDatasetId ?? undefined;
    }
    return undefined;
  }, [entityType, state.activeExperimentId, state.activeDatasetId]);

  // Get linking metadata for the current entity
  const linkingMetadata = useMemo(() => {
    if (!entityType || entityInternalId === undefined) return null;

    if (entityType === "experiment") {
      const exp = state.experiments.find((e) => e.id === entityInternalId);
      return exp?.linking || null;
    } else if (entityType === "dataset") {
      const ds = state.datasets.find((d) => d.id === entityInternalId);
      return ds?.linking || null;
    }
    return null;
  }, [entityType, entityInternalId, state.experiments, state.datasets]);

  // Determine if this field is currently linked
  const isLinked = useMemo(() => {
    if (mode === "simple") return false;
    if (!linkingMetadata) return false;

    if (mode === "project") {
      return linkingMetadata.usesLinkedProjectId === true;
    } else if (mode === "experiment" && entityType === "dataset") {
      const dsLinking = linkingMetadata as any;
      return (
        dsLinking.linkedExperimentInternalId !== null &&
        dsLinking.linkedExperimentInternalId !== undefined
      );
    }
    return false;
  }, [mode, linkingMetadata, entityType]);

  // Get the linked experiment internal ID for experiment mode
  const linkedExperimentInternalId = useMemo(() => {
    if (mode !== "experiment" || entityType !== "dataset" || !linkingMetadata) {
      return null;
    }
    return (linkingMetadata as any).linkedExperimentInternalId ?? null;
  }, [mode, entityType, linkingMetadata]);

  // Check if user has explicitly chosen custom experiment ID mode
  const usesCustomExperimentId = useMemo(() => {
    if (mode !== "experiment" || entityType !== "dataset" || !linkingMetadata) {
      return false;
    }
    return (linkingMetadata as any).usesCustomExperimentId === true;
  }, [mode, entityType, linkingMetadata]);

  // State for simple mode lock
  const [isLocked, setIsLocked] = useState(() => {
    return value ? true : defaultLocked;
  });
  const [hasBeenUnlockedManually, setHasBeenUnlockedManually] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Build experiment dropdown options
  const experimentDropdownOptions = useMemo((): ComboboxItem[] => {
    if (mode !== "experiment") return [];

    const items: ComboboxItem[] = [];

    for (const exp of state.experiments) {
      const expId = exp.formData?.experiment_id as string | undefined;
      const expName = exp.name || (exp.formData?.name as string | undefined);

      if (expId) {
        items.push({
          value: String(exp.id), // Internal ID for linking
          label: `${expName || "Experiment"} (${expId})`
        });
      }
    }

    items.push({
      value: CUSTOM_OPTION_VALUE,
      label: "Custom (manual entry)"
    });

    return items;
  }, [mode, state.experiments]);

  // Auto-lock when value appears (simple mode only)
  useEffect(() => {
    if (mode === "simple" && value && !hasBeenUnlockedManually && !isFocused) {
      setIsLocked(true);
    }
  }, [mode, value, hasBeenUnlockedManually, isFocused]);

  // Handle toggle lock (simple mode)
  const handleToggleLock = useCallback(() => {
    setIsLocked((prev) => {
      if (prev) {
        setHasBeenUnlockedManually(true);
      }
      return !prev;
    });
  }, []);

  // Handle toggle link (project/experiment modes)
  const handleToggleLink = useCallback(() => {
    if (!entityType || entityInternalId === undefined) return;

    if (isLinked) {
      // Unlink: switch to custom mode
      if (mode === "project") {
        if (entityType === "experiment") {
          updateExperimentLinking(entityInternalId, {
            usesLinkedProjectId: false
          });
        } else if (entityType === "dataset") {
          updateDatasetLinking(entityInternalId, {
            usesLinkedProjectId: false
          });
        }
      } else if (mode === "experiment" && entityType === "dataset") {
        // Unlink and set custom flag to show text input
        updateDatasetLinking(entityInternalId, {
          linkedExperimentInternalId: null,
          usesCustomExperimentId: true
        });
      }
    } else if (usesCustomExperimentId && mode === "experiment" && entityType === "dataset") {
      // Currently in custom mode, switch back to dropdown mode
      updateDatasetLinking(entityInternalId, {
        usesCustomExperimentId: false
      });
    } else {
      // Link: switch to linked mode
      if (mode === "project") {
        const projectId = state.projectData?.project_id || "";
        if (entityType === "experiment") {
          updateExperimentLinking(entityInternalId, {
            usesLinkedProjectId: true
          });
        } else if (entityType === "dataset") {
          updateDatasetLinking(entityInternalId, { usesLinkedProjectId: true });
        }
        onChange(projectId);
      } else if (mode === "experiment" && entityType === "dataset") {
        // For experiment mode, switch to linked state (shows dropdown)
        // If there's only one experiment with an ID, auto-link to it
        const experimentsWithId = state.experiments.filter(
          (exp) => exp.formData?.experiment_id
        );
        if (experimentsWithId.length === 1) {
          const exp = experimentsWithId[0];
          updateDatasetLinking(entityInternalId, {
            linkedExperimentInternalId: exp.id
          });
          onChange((exp.formData?.experiment_id as string) || "");
        } else if (experimentsWithId.length > 0) {
          // Multiple experiments - link to first one as default
          const exp = experimentsWithId[0];
          updateDatasetLinking(entityInternalId, {
            linkedExperimentInternalId: exp.id
          });
          onChange((exp.formData?.experiment_id as string) || "");
        }
        // If no experiments with IDs, stay unlinked
      }
    }
  }, [
    isLinked,
    usesCustomExperimentId,
    mode,
    entityType,
    entityInternalId,
    state.projectData,
    state.experiments,
    updateExperimentLinking,
    updateDatasetLinking,
    onChange
  ]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur - auto-lock if enabled (simple mode only)
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (mode === "simple" && lockOnBlur) {
      setIsLocked(true);
      setHasBeenUnlockedManually(false);
    }
    if (onBlur) {
      onBlur(id, value);
    }
  }, [mode, lockOnBlur, onBlur, id, value]);

  // Handle text input change
  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange(newValue === "" ? undefined : newValue);
    },
    [onChange]
  );

  // Handle experiment dropdown selection
  const handleExperimentSelect = useCallback(
    (selectedValue: string | null) => {
      if (!entityType || entityInternalId === undefined) return;
      if (entityType !== "dataset") return;

      if (selectedValue === CUSTOM_OPTION_VALUE) {
        // Switch to unlinked/custom mode - set flag to show text input
        updateDatasetLinking(entityInternalId, {
          linkedExperimentInternalId: null,
          usesCustomExperimentId: true
        });
        onChange(undefined);
      } else if (selectedValue) {
        // Link to selected experiment - clear custom flag
        const expInternalId = parseInt(selectedValue, 10);
        const exp = state.experiments.find((e) => e.id === expInternalId);
        const expId = (exp?.formData?.experiment_id as string) || "";

        updateDatasetLinking(entityInternalId, {
          linkedExperimentInternalId: expInternalId,
          usesCustomExperimentId: false
        });
        onChange(expId);
      }
    },
    [
      entityType,
      entityInternalId,
      state.experiments,
      updateDatasetLinking,
      onChange
    ]
  );

  // Render label
  const renderLabel = () => {
    if (hideLabel) return undefined;
    return label;
  };

  // Determine error state
  const hasError = rawErrors && rawErrors.length > 0;
  const errorMessage = hasError ? rawErrors.join(", ") : undefined;

  // Locked/linked input styles - grey background and text
  const readonlyInputStyles = {
    input: {
      backgroundColor: "var(--mantine-color-gray-1)",
      color: "var(--mantine-color-gray-6)"
    }
  };

  // =============================================================================
  // SIMPLE MODE: Lock/Unlock for source ID fields
  // =============================================================================
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
          styles={isLocked ? readonlyInputStyles : undefined}
        />
        <Box mb={hasError ? 22 : 0}>
          <Tooltip label={isLocked ? "Unlock to edit" : "Lock field"} withArrow>
            <ActionIcon
              variant={isLocked ? "light" : "default"}
              size="lg"
              onClick={handleToggleLock}
              disabled={disabled || readonly}
              aria-label={isLocked ? "Unlock field to edit" : "Lock field"}
            >
              {isLocked ? <IconLock size={18} /> : <IconLockOpen size={18} />}
            </ActionIcon>
          </Tooltip>
        </Box>
      </Group>
    );
  }

  // =============================================================================
  // PROJECT MODE: Link/Unlink for project_id inheritance
  // =============================================================================
  if (mode === "project") {
    const projectId = state.projectData?.project_id;
    const displayValue = isLinked ? projectId || "" : value || "";
    const placeholderText =
      isLinked && !projectId
        ? "Inherit from Project Metadata"
        : placeholder || "Enter project ID";

    return (
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          id={id}
          label={renderLabel()}
          placeholder={placeholderText}
          value={displayValue}
          required={required}
          disabled={disabled}
          readOnly={isLinked}
          error={errorMessage}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{ flex: 1 }}
          styles={isLinked ? readonlyInputStyles : undefined}
        />
        <Box mb={hasError ? 22 : 0}>
          <Tooltip
            label={
              isLinked
                ? "Unlink to enter custom Project ID"
                : "Link to Project ID from current session"
            }
            withArrow
          >
            <ActionIcon
              variant={isLinked ? "light" : "default"}
              size="lg"
              onClick={handleToggleLink}
              disabled={disabled || readonly}
              aria-label={isLinked ? "Unlink from project" : "Link to project"}
            >
              {isLinked ? <IconLink size={18} /> : <IconLinkOff size={18} />}
            </ActionIcon>
          </Tooltip>
        </Box>
      </Group>
    );
  }

  // =============================================================================
  // EXPERIMENT MODE: Link/Unlink with dropdown for experiment selection
  // =============================================================================
  if (mode === "experiment") {
    // Check if any experiments have experiment_id set
    const hasExperimentsWithIds = state.experiments.some(
      (exp) => exp.formData?.experiment_id
    );

    // Show dropdown when experiments with IDs exist AND user hasn't chosen custom mode
    if (hasExperimentsWithIds && !usesCustomExperimentId) {
      return (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <Select
            id={id}
            label={renderLabel()}
            placeholder="Select experiment"
            value={
              linkedExperimentInternalId !== null
                ? String(linkedExperimentInternalId)
                : null
            }
            required={required}
            disabled={disabled}
            readOnly={readonly}
            error={errorMessage}
            data={experimentDropdownOptions}
            onChange={handleExperimentSelect}
            onFocus={handleFocus}
            onBlur={handleBlur}
            allowDeselect={false}
            style={{ flex: 1 }}
          />
          <Box mb={hasError ? 22 : 0}>
            <Tooltip label="Unlink to enter custom Experiment ID" withArrow>
              <ActionIcon
                variant={isLinked ? "light" : "default"}
                size="lg"
                onClick={handleToggleLink}
                disabled={disabled || readonly}
                aria-label="Unlink from experiment"
              >
                {isLinked ? <IconLink size={18} /> : <IconLinkOff size={18} />}
              </ActionIcon>
            </Tooltip>
          </Box>
        </Group>
      );
    }

    // Show text input when no experiments with IDs OR user has entered a custom value
    return (
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          id={id}
          label={renderLabel()}
          placeholder={placeholder || "Enter experiment ID"}
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
          <Tooltip
            label={
              hasExperimentsWithIds
                ? "Link to an Experiment ID from the current session"
                : "No experiments with IDs available to link"
            }
            withArrow
          >
            <ActionIcon
              variant="default"
              size="lg"
              onClick={handleToggleLink}
              disabled={disabled || readonly || !hasExperimentsWithIds}
              aria-label="Link to experiment"
            >
              <IconLinkOff size={18} />
            </ActionIcon>
          </Tooltip>
        </Box>
      </Group>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
