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

import type { IChangeEvent } from "@rjsf/core";
import type { ErrorSchema, RJSFSchema, UiSchema } from "@rjsf/utils";
import type { DraftVariable } from "@/types/variable";

// =============================================================================
// Form Data Types
// =============================================================================

/**
 * Base type for schema-driven form data.
 * Use Record<string, unknown> instead of `any` to force explicit type narrowing.
 */
export type FormDataRecord = Record<string, unknown>;

/**
 * Experiment types that may be combined with each other. `model` is deliberately
 * absent: it is exclusive, which `ExperimentTypes` encodes structurally.
 * Kept as a runtime constant so the schema-sync test can assert this list
 * (plus "model") matches the bundled schema's experiment_types vocabulary.
 */
export const NON_MODEL_TYPES = [
  "baseline",
  "control",
  "intervention",
  "tracer_study",
  "other",
] as const;

export type NonModelType = (typeof NON_MODEL_TYPES)[number];

/**
 * The experiment_types selection with model exclusivity built into the type:
 * either exactly ["model"] or any combination of non-model types. A value like
 * ["model", "intervention"] is unconstructable in checked code; parseExperiment
 * establishes the invariant for data arriving from forms, imports, and restores.
 */
export type ExperimentTypes = ["model"] | NonModelType[];

/**
 * Project draft - schema-driven content
 * Known fields are typed, unknown fields allowed via index signature
 */
export interface DraftProject extends FormDataRecord {
  project_id?: string;
  name?: string;
  description?: string;
  // ... other known fields can be added as needed
}

/**
 * Experiment draft - schema-driven content
 * Known fields are typed, unknown fields allowed via index signature.
 * experiment_types carries the model-exclusivity invariant; parseExperiment is
 * the only sanctioned producer of this type from raw data.
 */
export interface DraftExperiment extends FormDataRecord {
  project_id?: string;
  experiment_id?: string;
  experiment_types?: ExperimentTypes;
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
 * Dataset draft - schema-driven content.
 * dataset_type stays a plain string on purpose: only "model_output" changes any
 * behavior (ModelOutputDataset vs FieldDataset schema selection), and the other
 * values are schema vocabulary the app never branches on — see
 * isModelOutputType() in utils/datasetFields. Invariant enforced by
 * parseDataset, not the type system: when dataset_type is "model_output",
 * `variables` holds ModelOutputVariable entries, which carry neither genesis
 * nor sampling.
 */
export interface DraftDataset extends FormDataRecord {
  project_id?: string;
  experiment_id?: string;
  name?: string;
  description?: string;
  temporal_coverage?: string;
  dataset_type?: string;
  data_product_type?: string;
  variables?: DraftVariable[];
  // ... other known fields can be added as needed
}

// =============================================================================
// ID Linking Metadata Types
// =============================================================================

/**
 * ID linking metadata for datasets.
 * Controls how experiment_id is synchronized from a parent experiment.
 * Note: project_id is always auto-synced from the project — no opt-out.
 */
export interface DatasetLinkingMetadata {
  /** If set, experiment_id auto-syncs from this experiment's internal ID */
  linkedExperimentInternalId: number | null;
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
  formData: DraftExperiment;
  /** Experiment type for conditional schema selection */
  experiment_types?: ExperimentTypes;
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
  formData: DraftDataset;
  /** ID linking metadata - controls how experiment_id syncs from a parent experiment */
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
  hasProject: boolean;
  projectData: DraftProject;
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
  project?: DraftProject;
  experiments?: DraftExperiment[];
  datasets?: DraftDataset[];
}

/**
 * Import result from file parsing
 */
export interface ImportResult {
  projectData: DraftProject;
  experiments: ExperimentState[];
  datasets: DatasetState[];
}

// =============================================================================
// RJSF Event Types
// =============================================================================

/**
 * Typed RJSF change event for project form
 */
export type ProjectChangeEvent = IChangeEvent<DraftProject, RJSFSchema>;

/**
 * Typed RJSF change event for experiment form
 */
export type ExperimentChangeEvent = IChangeEvent<DraftExperiment, RJSFSchema>;

/**
 * Typed RJSF change event for dataset form
 */
export type DatasetChangeEvent = IChangeEvent<DraftDataset, RJSFSchema>;

/**
 * Generic form change handler
 */
export type FormChangeHandler<T extends FormDataRecord> = (
  event: IChangeEvent<T, RJSFSchema>,
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
 * Geographic bounding box as SOSO string: "minLat minLon maxLat maxLon"
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

/**
 * Vertical coverage value object (meters; depths are non-positive = below the
 * sea surface, heights non-negative = above it)
 */
export interface VerticalCoverage {
  min_depth_in_m?: number;
  max_depth_in_m?: number;
  min_height_in_m?: number;
  max_height_in_m?: number;
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
  data: FormDataRecord,
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
  data: FormDataRecord,
): data is FormDataRecord & { spatial_coverage: { geo: { box: string } } } {
  if (!hasSpatialCoverage(data)) return false;
  const geo = data.spatial_coverage.geo as Record<string, unknown>;
  return typeof geo.box === "string";
}

/**
 * Check if geo data is coordinates (point)
 */
export function isGeoCoordinates(geo: unknown): geo is GeoCoordinates {
  return isObject(geo) && typeof geo.latitude === "number" && typeof geo.longitude === "number";
}

/**
 * Check if geo data is a shape (box/line)
 */
export function isGeoShape(geo: unknown): geo is GeoShape {
  return isObject(geo) && (typeof geo.box === "string" || typeof geo.line === "string");
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

export type { ErrorSchema, RJSFSchema, UiSchema };
