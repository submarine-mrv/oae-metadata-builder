/**
 * LinkedExperimentIdWidget - Select experiment from dropdown
 *
 * Used for:
 * - Dataset page: experiment_id
 *
 * Behavior:
 * - Hidden when no experiments exist in the app
 * - Shows all experiments in the dropdown (by name), plus a "None" option
 * - When linked experiment has an experiment_id, uses that value
 * - When linked experiment has no experiment_id, shows a warning error
 */

import React, { useMemo, useState } from "react";
import { Select, ComboboxItem, Box, Text, Tooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps
} from "@rjsf/utils";
import { useAppState } from "@/contexts/AppStateContext";
import DescriptionModal from "./DescriptionModal";

const NONE_OPTION_VALUE = "__none__";

export default function LinkedExperimentIdWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: WidgetProps<T, S, F>) {
  const {
    id,
    value,
    required,
    disabled,
    readonly,
    label,
    hideLabel,
    rawErrors,
    onChange,
    onBlur,
    schema,
    uiSchema
  } = props;

  const description = schema?.description;
  const useModal = uiSchema?.["ui:descriptionModal"] === true;
  const [modalOpened, setModalOpened] = useState(false);

  const { state, updateDatasetLinking } = useAppState();

  // Get the active dataset's internal ID
  const datasetInternalId = state.activeDatasetId ?? undefined;

  // Get linking metadata for the current dataset
  const linkingMetadata = useMemo(() => {
    if (datasetInternalId === undefined) return null;
    const ds = state.datasets.find((d) => d.id === datasetInternalId);
    return ds?.linking || null;
  }, [datasetInternalId, state.datasets]);

  // Which experiment is currently linked (if any)
  const linkedExperimentInternalId =
    linkingMetadata?.linkedExperimentInternalId ?? null;

  // Get the linked experiment object
  const linkedExperiment = useMemo(() => {
    if (linkedExperimentInternalId === null) return null;
    return state.experiments.find((e) => e.id === linkedExperimentInternalId) || null;
  }, [linkedExperimentInternalId, state.experiments]);

  // Check if linked experiment is missing an experiment_id
  const linkedExperimentMissingId =
    linkedExperiment !== null && !linkedExperiment.formData?.experiment_id;

  // Don't render at all if no experiments exist
  if (state.experiments.length === 0) {
    return null;
  }

  // Build dropdown options: all experiments (by name), then "None" at end
  const dropdownOptions: ComboboxItem[] = [
    ...state.experiments.map((exp) => {
      const expName = exp.name || (exp.formData?.name as string | undefined) || "Experiment";
      return {
        value: String(exp.id),
        label: expName
      };
    }),
    { value: NONE_OPTION_VALUE, label: "None" }
  ];

  // Handle dropdown selection
  const handleDropdownSelect = (selectedValue: string | null) => {
    if (datasetInternalId === undefined) return;

    if (selectedValue === NONE_OPTION_VALUE) {
      // Clear experiment linking
      updateDatasetLinking(datasetInternalId, {
        linkedExperimentInternalId: null
      });
      onChange(undefined);
    } else if (selectedValue) {
      const expInternalId = parseInt(selectedValue, 10);
      const exp = state.experiments.find((e) => e.id === expInternalId);
      const expId = (exp?.formData?.experiment_id as string) || "";

      updateDatasetLinking(datasetInternalId, {
        linkedExperimentInternalId: expInternalId
      });
      onChange(expId || undefined);
    }
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur(id, value);
    }
  };

  const hasError = rawErrors && rawErrors.length > 0;

  // Build error message: custom warning takes priority if linked experiment has no ID
  const errorMessage = linkedExperimentMissingId
    ? `Linked experiment "${linkedExperiment!.name}" has no Experiment ID. Please set one on the Experiment page.`
    : hasError
      ? rawErrors.join(", ")
      : undefined;

  // Determine the Select value: linked experiment, or "None" if explicitly unset
  const selectValue =
    linkedExperimentInternalId !== null
      ? String(linkedExperimentInternalId)
      : null;

  return (
    <>
      <Box style={{ position: "relative" }}>
        <Select
          id={id}
          label={hideLabel ? undefined : label}
          placeholder="Select experiment"
          value={selectValue}
          required={required}
          disabled={disabled}
          readOnly={readonly}
          error={errorMessage}
          data={dropdownOptions}
          onChange={handleDropdownSelect}
          onBlur={handleBlur}
          allowDeselect={false}
        />
        {description && !hideLabel && (
          <Box style={{
            position: "absolute",
            top: "2px",
            left: "0",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            <Text
              size="sm"
              fw={500}
              style={{
                visibility: "hidden",
                marginRight: "4px"
              }}
            >
              {label}{required && " *"}
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
                <Tooltip
                  label={description}
                  position="top"
                  withArrow
                  multiline
                  maw={400}
                  style={{ wordWrap: "break-word" }}
                >
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
