/**
 * Comprehensive type definitions for OAE Metadata Builder forms
 * These types replace the use of 'any' throughout the application
 */

export interface SpatialCoverage {
  geo?: {
    box?: string;
    point?: {
      latitude: number;
      longitude: number;
    };
    line?: {
      start: {
        latitude: number;
        longitude: number;
      };
      end: {
        latitude: number;
        longitude: number;
      };
    };
  };
}

export interface VerticalCoverage {
  min_depth_in_m?: number;
  max_depth_in_m?: number;
}

export interface Investigator {
  name: string;
  email?: string;
  affiliation?: string;
  orcid?: string;
}

export interface ExternalProject {
  name: string;
  url?: string;
  description?: string;
}

export interface ProjectFormData {
  project_id: string;
  project_description?: string;
  mcdr_pathway?: string;
  sea_names?: string[];
  temporal_coverage?: string;
  spatial_coverage?: SpatialCoverage;
  vertical_coverage?: VerticalCoverage;
  physical_site_description?: string;
  social_context_site_description?: string;
  social_research_conducted_to_date?: string;
  colocated_operations?: string;
  previous_or_ongoing_colocated_research?: string;
  public_comments?: string;
  permits?: string;
  research_project?: ExternalProject[];
  funding?: string;
  additional_details?: string;
}

export type ExperimentType =
  | "baseline"
  | "control"
  | "model"
  | "intervention"
  | "tracer_study"
  | "intervention_with_tracer"
  | "other";

export interface DosingLocation {
  geo?: {
    box?: string;
    point?: {
      latitude: number;
      longitude: number;
    };
    line?: {
      start: { latitude: number; longitude: number };
      end: { latitude: number; longitude: number };
    };
  };
}

export interface ExperimentBaseData {
  experiment_id: string;
  experiment_type?: ExperimentType;
  description?: string;
  spatial_coverage?: SpatialCoverage;
  vertical_coverage?: VerticalCoverage;
  investigators?: Investigator[];
  start_datetime?: string;
  end_datetime?: string;
  project_id?: string;
}

export interface InterventionData extends ExperimentBaseData {
  alkalinity_feedstock?: string;
  alkalinity_feedstock_description?: string;
  alkalinity_feedstock_form?: string;
  alkalinity_feedstock_processing?: string;
  equilibration?: string;
  dosing_location?: DosingLocation;
  dosing_dispersal_hydrologic_location?: string;
  dosing_delivery_type?: string;
  alkalinity_dosing_effluent_density?: number;
  dosing_depth?: {
    min_depth_in_m?: number;
    max_depth_in_m?: number;
  };
  dosing_description?: string;
  dosing_regimen?: string;
  dosing_data?: unknown; // Complex nested structure, use unknown for safety
}

export interface TracerData extends ExperimentBaseData {
  tracer_concentration?: number;
  tracer_details?: string;
  tracer_form?: string;
  dosing_location?: DosingLocation;
  dosing_depth?: {
    min_depth_in_m?: number;
    max_depth_in_m?: number;
  };
  dosing_description?: string;
  dosing_regimen?: string;
}

export type ExperimentFormData = ExperimentBaseData | InterventionData | TracerData;

export interface ExperimentData {
  id: number;
  name: string;
  formData: ExperimentFormData;
  experiment_type?: ExperimentType;
  createdAt: number;
  updatedAt: number;
}

export interface ValidationError {
  property: string;
  message: string;
  name: string;
  params?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  errorCount: number;
}
