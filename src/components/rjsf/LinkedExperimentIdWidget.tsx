/**
 * LinkedExperimentIdWidget - Select experiment from dropdown or enter custom ID
 *
 * Used for:
 * - Dataset page: experiment_id
 *
 * Mode Determination:
 * 1. Default: dropdown mode (even if no experiments exist yet)
 * 2. User has chosen custom mode (usesCustomExperimentId=true) → "freetext" mode
 *
 * When no experiments with IDs exist, dropdown is shown but disabled with a
 * placeholder message indicating options will be autopopulated when available.
 *
 * State Persistence:
 * - During a session: usesCustomExperimentId persists even if value is cleared
 * - On navigation back (remount): if value is empty, resets to dropdown mode
 *
 * The link icon represents the MODE (dropdown vs freetext), not whether an
 * experiment is actually selected. Dropdown mode = linked icon, freetext = unlinked icon.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { TextInput, Select, ComboboxItem } from "@mantine/core";
import { IconLink, IconLinkOff } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps
} from "@rjsf/utils";
import { useAppState } from "@/contexts/AppStateContext";
import { IdFieldLayout } from "./IdFieldLayout";

const CUSTOM_OPTION_VALUE = "__custom__";

export default function LinkedExperimentIdWidget<
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
    onBlur
  } = props;

  const { state, updateDatasetLinking } = useAppState();

  // Get the active dataset's internal ID
  const datasetInternalId = state.activeDatasetId ?? undefined;

  // Get linking metadata for the current dataset
  const linkingMetadata = useMemo(() => {
    if (datasetInternalId === undefined) return null;
    const ds = state.datasets.find((d) => d.id === datasetInternalId);
    return ds?.linking || null;
  }, [datasetInternalId, state.datasets]);

  // Experiments that have an experiment_id set
  const experimentsWithIds = useMemo(
    () => state.experiments.filter((exp) => exp.formData?.experiment_id),
    [state.experiments]
  );

  // Which experiment is currently linked (if any)
  const linkedExperimentInternalId =
    linkingMetadata?.linkedExperimentInternalId ?? null;

  // Lazy reset: if value is empty on mount, reset to dropdown mode
  // This handles the "navigate away and back" case
  useEffect(() => {
    if (datasetInternalId === undefined) return;
    if (!value && linkingMetadata?.usesCustomExperimentId) {
      updateDatasetLinking(datasetInternalId, {
        usesCustomExperimentId: false
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount - intentionally empty deps

  // Lock in freetext mode if we have a non-empty value but usesCustomExperimentId was never set
  // This handles the case where user entered a value when no experiments existed,
  // then later experiments with IDs are created - we should stay in freetext mode
  // Note: we check for `=== undefined` (not just falsy) to respect explicit `false` values
  // set by user actions like clicking the link button to switch to dropdown mode
  useEffect(() => {
    if (datasetInternalId === undefined) return;
    if (
      value &&
      linkingMetadata?.usesCustomExperimentId === undefined &&
      linkedExperimentInternalId === null
    ) {
      updateDatasetLinking(datasetInternalId, { usesCustomExperimentId: true });
    }
  }, [
    value,
    linkedExperimentInternalId,
    linkingMetadata?.usesCustomExperimentId,
    datasetInternalId,
    updateDatasetLinking
  ]);

  // Determine the current mode:
  // - "dropdown" by default (even if no experiments exist)
  // - "freetext" only if user has explicitly chosen custom mode
  // Note: usesCustomExperimentId persists during session even if value is cleared,
  // but gets reset on mount if value is empty (see useEffect above)
  const isDropdownMode = !linkingMetadata?.usesCustomExperimentId;

  // Check if experiments with IDs exist (for enabling/disabling dropdown)
  const hasExperimentsWithIds = experimentsWithIds.length > 0;

  // Build dropdown options
  const dropdownOptions = useMemo((): ComboboxItem[] => {
    const items: ComboboxItem[] = experimentsWithIds.map((exp) => {
      const expId = exp.formData?.experiment_id as string;
      const expName = exp.name || (exp.formData?.name as string | undefined);
      return {
        value: String(exp.id),
        label: `${expName || "Experiment"} (${expId})`
      };
    });

    items.push({
      value: CUSTOM_OPTION_VALUE,
      label: "Custom (manual entry)"
    });

    return items;
  }, [experimentsWithIds]);

  // Handle dropdown selection
  const handleDropdownSelect = useCallback(
    (selectedValue: string | null) => {
      if (datasetInternalId === undefined) return;

      if (selectedValue === CUSTOM_OPTION_VALUE) {
        // Switch to custom mode
        updateDatasetLinking(datasetInternalId, {
          linkedExperimentInternalId: null,
          usesCustomExperimentId: true
        });
        onChange(undefined);
      } else if (selectedValue) {
        // Link to selected experiment
        const expInternalId = parseInt(selectedValue, 10);
        const exp = state.experiments.find((e) => e.id === expInternalId);
        const expId = (exp?.formData?.experiment_id as string) || "";

        updateDatasetLinking(datasetInternalId, {
          linkedExperimentInternalId: expInternalId,
          usesCustomExperimentId: false
        });
        onChange(expId);
      }
    },
    [datasetInternalId, state.experiments, updateDatasetLinking, onChange]
  );

  // Handle switching from custom mode back to dropdown
  const handleSwitchToDropdown = useCallback(() => {
    if (datasetInternalId === undefined) return;

    updateDatasetLinking(datasetInternalId, {
      usesCustomExperimentId: false
    });
    // Clear the value since they're switching to dropdown selection
    onChange(undefined);
  }, [datasetInternalId, updateDatasetLinking, onChange]);

  // Handle switching from dropdown to custom mode (via button)
  const handleSwitchToCustom = useCallback(() => {
    if (datasetInternalId === undefined) return;

    // Always clear value when switching to freetext - user requested empty field
    updateDatasetLinking(datasetInternalId, {
      linkedExperimentInternalId: null,
      usesCustomExperimentId: true
    });
    onChange(undefined);
  }, [datasetInternalId, updateDatasetLinking, onChange]);

  // Handle text input change
  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      onChange(newValue === "" ? undefined : newValue);
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur(id, value);
    }
  }, [onBlur, id, value]);

  const hasError = rawErrors && rawErrors.length > 0;
  const errorMessage = hasError ? rawErrors.join(", ") : undefined;

  // Placeholder text depends on whether experiments with IDs exist
  const dropdownPlaceholder = hasExperimentsWithIds
    ? "Select experiment"
    : "No experiments with valid Experiment ID are available";

  // =============================================================================
  // RENDER: Dropdown mode → show dropdown with linked icon
  // =============================================================================
  if (isDropdownMode) {
    return (
      <IdFieldLayout
        buttonIcon={<IconLink size={18} />}
        buttonTooltip="Unlink to enter custom Experiment ID"
        buttonVariant="light"
        buttonAriaLabel="Unlink to enter custom Experiment ID"
        onButtonClick={handleSwitchToCustom}
        buttonDisabled={disabled || readonly}
        hasError={hasError}
      >
        <Select
          id={id}
          label={hideLabel ? undefined : label}
          placeholder={dropdownPlaceholder}
          value={
            linkedExperimentInternalId !== null
              ? String(linkedExperimentInternalId)
              : null
          }
          required={required}
          disabled={disabled || !hasExperimentsWithIds}
          readOnly={readonly}
          error={errorMessage}
          data={dropdownOptions}
          onChange={handleDropdownSelect}
          onBlur={handleBlur}
          allowDeselect={false}
        />
      </IdFieldLayout>
    );
  }

  // =============================================================================
  // RENDER: Freetext mode → show text input with unlinked icon
  // =============================================================================
  return (
    <IdFieldLayout
      buttonIcon={<IconLinkOff size={18} />}
      buttonTooltip="Switch to experiment selection"
      buttonVariant="default"
      buttonAriaLabel="Switch to experiment selection"
      onButtonClick={handleSwitchToDropdown}
      buttonDisabled={disabled || readonly}
      hasError={hasError}
    >
      <TextInput
        id={id}
        label={hideLabel ? undefined : label}
        placeholder={placeholder || "Enter experiment ID"}
        value={value || ""}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        error={errorMessage}
        onChange={handleTextChange}
        onBlur={handleBlur}
      />
    </IdFieldLayout>
  );
}
