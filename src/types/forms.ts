/**
 * Type definitions for OAE Metadata Form
 *
 * Strategy: "Typed Envelope, Flexible Content"
 *
 * We type the structural parts (container, metadata, state management) but keep
 * the schema-driven form content flexible. This avoids duplicating the JSON Schema
 * in TypeScript while still providing type safety for our application logic.
 *
 * Key principles:
 * 1. Use `Record<string, unknown>` instead of `any` - forces explicit type narrowing
 * 2. Type guards for runtime checking of known fields
 * 3. RJSF's built-in types for form handling
 * 4. Explicit types for our custom structures
 */

import type { RJSFSchema, UiSchema, ErrorSchema } from "@rjsf/utils";
import type { IChangeEvent } from "@rjsf/core";

// =============================================================================
// Form Data Types
// =============================================================================

/**
 * Base type for schema-driven form data.
 * Use Record<string, unknown> instead of `any` to force explicit type narrowing.
 */
export type FormDataRecord = Record<string, unknown>;

/**
 * Project form data - schema-driven content
 * Known fields are typed, unknown fields allowed via index signature
 */
export interface ProjectFormData extends FormDataRecord {
  project_id?: string;
  name?: string;
  description?: string;
  // ... other known fields can be added as needed
}

/**
 * Experiment form data - schema-driven content
 * Known fields are typed, unknown fields allowed via index signature
 */
export interface ExperimentFormData extends FormDataRecord {
  project_id?: string;
  experiment_type?: string;
  description?: string;
  // Spatial coverage has a known structure
  spatial_coverage?: {
    geo?: {
      box?: string;
    };
  };
  // Temporal coverage has a known structure
  temporal_coverage?: string; // ISO interval format
  // ... other known fields can be added as needed
}

/**
 * Variable form data - schema-driven content
 * All variable types share these common fields
 */
export interface VariableFormData extends FormDataRecord {
  variable_type?: string; // Discriminator field (e.g., "DICVariable", "PHVariable")
  dataset_variable_name?: string;
  long_name?: string;
  variable_unit?: string;
  // ... other fields are type-specific and handled via FormDataRecord
}

/**
 * Dataset form data - schema-driven content
 */
export interface DatasetFormData extends FormDataRecord {
  project_id?: string;
  experiment_id?: string;
  name?: string;
  description?: string;
  temporal_coverage?: string;
  dataset_type?: string;
  data_product_type?: string;
  variables?: VariableFormData[];
  // ... other known fields can be added as needed
}

// =============================================================================
// ID Linking Metadata Types
// =============================================================================

/**
 * ID linking metadata for experiments.
 * Controls how project_id is synchronized from the root project.
 */
export interface ExperimentLinkingMetadata {
  /** If true, project_id auto-syncs from root project */
  usesLinkedProjectId: boolean;
}

/**
 * ID linking metadata for datasets.
 * Controls how project_id and experiment_id are synchronized from parent entities.
 */
export interface DatasetLinkingMetadata {
  /** If true, project_id auto-syncs from root project */
  usesLinkedProjectId: boolean;
  /** If set, experiment_id auto-syncs from this experiment's internal ID */
  linkedExperimentInternalId: number | null;
  /** If true, user has chosen custom/manual experiment_id entry (shows text input) */
  usesCustomExperimentId?: boolean;
}

// =============================================================================
// Application State Types
// =============================================================================

/**
 * Experiment data as stored in application state
 */
export interface ExperimentState {
  /** Internal integer ID for tracking */
  id: number;
  /** Display name */
  name: string;
  /** Form data (schema-driven) */
  formData: ExperimentFormData;
  /** Experiment type for conditional schema selection */
  experiment_type?: string;
  /** ID linking metadata - controls how IDs sync from parent entities */
  linking?: ExperimentLinkingMetadata;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Dataset data as stored in application state
 */
export interface DatasetState {
  /** Internal integer ID for tracking */
  id: number;
  /** Display name */
  name: string;
  /** Form data (schema-driven) */
  formData: DatasetFormData;
  /** ID linking metadata - controls how IDs sync from parent entities */
  linking?: DatasetLinkingMetadata;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Main application state
 */
export interface AppFormState {
  projectData: ProjectFormData;
  experiments: ExperimentState[];
  datasets: DatasetState[];
  activeTab: "overview" | "project" | "experiment" | "dataset";
  activeExperimentId: number | null;
  activeDatasetId: number | null;
  nextExperimentId: number;
  nextDatasetId: number;
  triggerValidation: boolean;
  showJsonPreview: boolean;
}

// =============================================================================
// Export/Import Types
// =============================================================================

/**
 * Container structure for exported data (matches JSON Schema Container)
 * Note: experiments and datasets are top-level arrays, NOT nested in project
 */
export interface ExportContainer {
  version?: string;
  protocol_git_hash?: string;
  metadata_builder_git_hash?: string;
  project?: ProjectFormData;
  experiments?: ExperimentFormData[];
  datasets?: DatasetFormData[];
}

/**
 * Import result from file parsing
 */
export interface ImportResult {
  projectData: ProjectFormData;
  experiments: ExperimentState[];
  datasets: DatasetState[];
}

// =============================================================================
// RJSF Event Types
// =============================================================================

/**
 * Typed RJSF change event for project form
 */
export type ProjectChangeEvent = IChangeEvent<ProjectFormData, RJSFSchema>;

/**
 * Typed RJSF change event for experiment form
 */
export type ExperimentChangeEvent = IChangeEvent<ExperimentFormData, RJSFSchema>;

/**
 * Typed RJSF change event for dataset form
 */
export type DatasetChangeEvent = IChangeEvent<DatasetFormData, RJSFSchema>;

/**
 * Generic form change handler
 */
export type FormChangeHandler<T extends FormDataRecord> = (
  event: IChangeEvent<T, RJSFSchema>
) => void;

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  path?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// =============================================================================
// Geo Types (for spatial coverage)
// =============================================================================

/**
 * Geographic bounding box as "W S E N" string
 */
export type BoundingBoxString = string;

/**
 * Parsed bounding box coordinates
 */
export interface BoundingBoxCoords {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Geographic coordinates (point)
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Geographic shape (box or line)
 */
export interface GeoShape {
  box?: BoundingBoxString;
  line?: string; // "lat1 lon1 lat2 lon2"
}

/**
 * Spatial coverage data structure
 */
export interface SpatialCoverage {
  geo?: GeoShape | GeoCoordinates;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if form data has spatial coverage
 */
export function hasSpatialCoverage(
  data: FormDataRecord
): data is FormDataRecord & { spatial_coverage: SpatialCoverage } {
  return (
    isObject(data.spatial_coverage) &&
    isObject((data.spatial_coverage as Record<string, unknown>).geo)
  );
}

/**
 * Check if form data has a bounding box
 */
export function hasBoundingBox(
  data: FormDataRecord
): data is FormDataRecord & { spatial_coverage: { geo: { box: string } } } {
  if (!hasSpatialCoverage(data)) return false;
  const geo = data.spatial_coverage.geo as Record<string, unknown>;
  return typeof geo.box === "string";
}

/**
 * Check if geo data is coordinates (point)
 */
export function isGeoCoordinates(geo: unknown): geo is GeoCoordinates {
  return (
    isObject(geo) &&
    typeof geo.latitude === "number" &&
    typeof geo.longitude === "number"
  );
}

/**
 * Check if geo data is a shape (box/line)
 */
export function isGeoShape(geo: unknown): geo is GeoShape {
  return (
    isObject(geo) &&
    (typeof geo.box === "string" || typeof geo.line === "string")
  );
}

/**
 * Safely get a string property from unknown data
 */
export function getString(data: unknown, key: string): string | undefined {
  if (!isObject(data)) return undefined;
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Safely get a number property from unknown data
 */
export function getNumber(data: unknown, key: string): number | undefined {
  if (!isObject(data)) return undefined;
  const value = data[key];
  return typeof value === "number" ? value : undefined;
}

// =============================================================================
// Re-exports from RJSF for convenience
// =============================================================================

export type { RJSFSchema, UiSchema, ErrorSchema };
