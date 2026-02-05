/**
 * LinkedProjectIdWidget - Link/unlink to inherit project_id from Project metadata
 *
 * Used for:
 * - Experiment page: project_id (inherit from Project)
 * - Dataset page: project_id (inherit from Project)
 *
 * Behavior:
 * - When linked: shows readonly text input with project_id from Project metadata
 * - When unlinked: shows editable text input for custom project_id
 * - Click link/unlink button to toggle
 */

import React, { useCallback, useMemo } from "react";
import { TextInput } from "@mantine/core";
import { IconLink, IconLinkOff } from "@tabler/icons-react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  WidgetProps
} from "@rjsf/utils";
import { useAppState } from "@/contexts/AppStateContext";
import { IdFieldLayout } from "./IdFieldLayout";

interface LinkedProjectIdOptions {
  entityType?: "experiment" | "dataset";
}

export default function LinkedProjectIdWidget<
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
    uiSchema
  } = props;

  const { state, updateExperimentLinking, updateDatasetLinking } =
    useAppState();

  const options = (uiSchema?.["ui:options"] || {}) as LinkedProjectIdOptions;
  const entityType = options.entityType;

  // Get the active entity's internal ID
  const entityInternalId = useMemo(() => {
    if (entityType === "experiment") {
      return state.activeExperimentId ?? undefined;
    } else if (entityType === "dataset") {
      return state.activeDatasetId ?? undefined;
    }
    return undefined;
  }, [entityType, state.activeExperimentId, state.activeDatasetId]);

  // Get linking metadata for the current entity
  const isLinked = useMemo(() => {
    if (entityInternalId === undefined) return false;

    if (entityType === "experiment") {
      const exp = state.experiments.find((e) => e.id === entityInternalId);
      return exp?.linking?.usesLinkedProjectId === true;
    } else if (entityType === "dataset") {
      const ds = state.datasets.find((d) => d.id === entityInternalId);
      return ds?.linking?.usesLinkedProjectId === true;
    }
    return false;
  }, [entityType, entityInternalId, state.experiments, state.datasets]);

  // The project_id from the root Project metadata
  const projectId = state.projectData?.project_id || "";

  const handleToggleLink = useCallback(() => {
    if (entityInternalId === undefined) return;

    if (isLinked) {
      // Unlink: switch to custom mode
      if (entityType === "experiment") {
        updateExperimentLinking(entityInternalId, {
          usesLinkedProjectId: false
        });
      } else if (entityType === "dataset") {
        updateDatasetLinking(entityInternalId, { usesLinkedProjectId: false });
      }
    } else {
      // Link: inherit from project
      if (entityType === "experiment") {
        updateExperimentLinking(entityInternalId, {
          usesLinkedProjectId: true
        });
      } else if (entityType === "dataset") {
        updateDatasetLinking(entityInternalId, { usesLinkedProjectId: true });
      }
      onChange(projectId);
    }
  }, [
    isLinked,
    entityType,
    entityInternalId,
    projectId,
    updateExperimentLinking,
    updateDatasetLinking,
    onChange
  ]);

  const handleChange = useCallback(
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

  // Display value: project's ID when linked, custom value when unlinked
  const displayValue = isLinked ? projectId : value || "";
  const placeholderText = isLinked
    ? "Project ID will be autopopulated from Project Metadata"
    : "Enter project ID";

  const linkedStyles = {
    input: {
      backgroundColor: "var(--mantine-color-gray-1)",
      color: "var(--mantine-color-gray-6)"
    }
  };

  return (
    <IdFieldLayout
      buttonIcon={isLinked ? <IconLink size={18} /> : <IconLinkOff size={18} />}
      buttonTooltip={
        isLinked
          ? "Unlink to enter custom Project ID"
          : "Link to Project ID from Project Metadata"
      }
      buttonVariant={isLinked ? "light" : "default"}
      buttonAriaLabel={isLinked ? "Unlink from project" : "Link to project"}
      onButtonClick={handleToggleLink}
      buttonDisabled={disabled || readonly}
      hasError={hasError}
    >
      <TextInput
        id={id}
        label={hideLabel ? undefined : label}
        placeholder={placeholderText}
        value={displayValue}
        required={required}
        disabled={disabled}
        readOnly={isLinked}
        error={errorMessage}
        onChange={handleChange}
        onBlur={handleBlur}
        styles={isLinked ? linkedStyles : undefined}
      />
    </IdFieldLayout>
  );
}
