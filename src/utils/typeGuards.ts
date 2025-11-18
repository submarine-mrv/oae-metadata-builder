/**
 * Type guards for runtime type checking
 * These functions help narrow types and provide type safety at runtime
 */

import {
  ExperimentType,
  ExperimentFormData,
  InterventionData,
  TracerData
} from "@/types/forms";

/**
 * Checks if an experiment type is an intervention type
 */
export function isInterventionType(type?: ExperimentType): boolean {
  return type === "intervention" || type === "intervention_with_tracer";
}

/**
 * Checks if an experiment type is a tracer type
 */
export function isTracerType(type?: ExperimentType): boolean {
  return type === "tracer_study" || type === "intervention_with_tracer";
}

/**
 * Type guard to check if experiment data has intervention fields
 */
export function hasInterventionData(
  data: ExperimentFormData
): data is InterventionData {
  return (
    "alkalinity_feedstock" in data ||
    "alkalinity_feedstock_description" in data ||
    "alkalinity_feedstock_form" in data ||
    "alkalinity_feedstock_processing" in data ||
    "equilibration" in data ||
    "dosing_delivery_type" in data ||
    "alkalinity_dosing_effluent_density" in data ||
    "dosing_dispersal_hydrologic_location" in data
  );
}

/**
 * Type guard to check if experiment data has tracer fields
 */
export function hasTracerData(data: ExperimentFormData): data is TracerData {
  return (
    "tracer_concentration" in data ||
    "tracer_details" in data ||
    "tracer_form" in data
  );
}

/**
 * Checks if a value is a valid experiment type
 */
export function isValidExperimentType(value: unknown): value is ExperimentType {
  return (
    typeof value === "string" &&
    [
      "baseline",
      "control",
      "model",
      "intervention",
      "tracer_study",
      "intervention_with_tracer",
      "other"
    ].includes(value)
  );
}
