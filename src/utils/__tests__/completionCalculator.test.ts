// completionCalculator.test.ts - Tests for completion calculation utility

import { describe, it, expect } from "vitest";
import {
  calculateFormCompletion,
  calculateProjectCompletion
} from "../completionCalculator";

describe("completionCalculator", () => {
  describe("calculateProjectCompletion", () => {
    it("should return 0 for empty data", () => {
      expect(calculateProjectCompletion({})).toBe(0);
      expect(calculateProjectCompletion(null)).toBe(0);
    });

    it("should calculate percentage correctly", () => {
      const projectData = {
        project_id: "TEST-001",
        description: "Test description",
        mcdr_pathway: "ocean_alkalinity_enhancement",
        sea_names: ["North Atlantic Ocean"],
        spatial_coverage: { geo: { box: "0 0 10 10" } },
        temporal_coverage: "2024-01-01/2024-12-31"
      };

      const result = calculateProjectCompletion(projectData);
      expect(result).toBe(100);
    });

    it("should handle partially filled data", () => {
      const projectData = {
        project_id: "TEST-001",
        description: "Test description",
        mcdr_pathway: "ocean_alkalinity_enhancement"
        // Missing 3 required fields
      };

      const result = calculateProjectCompletion(projectData);
      expect(result).toBe(50); // 3 out of 6 fields filled
    });

    it("should ignore empty strings", () => {
      const projectData = {
        project_id: "",
        description: "   ", // whitespace only
        mcdr_pathway: "ocean_alkalinity_enhancement"
      };

      const result = calculateProjectCompletion(projectData);
      expect(result).toBe(17); // Only 1 out of 6 fields filled
    });

    it("should count non-empty arrays", () => {
      const projectData = {
        project_id: "TEST-001",
        description: "Test",
        mcdr_pathway: "test",
        sea_names: ["Ocean 1", "Ocean 2"], // Non-empty array counts
        spatial_coverage: {},
        temporal_coverage: ""
      };

      const result = calculateProjectCompletion(projectData);
      expect(result).toBe(67); // 4 out of 6 fields filled
    });
  });

  describe("calculateFormCompletion", () => {
    it("should return 0 for empty data", () => {
      expect(calculateFormCompletion({}, "intervention")).toBe(0);
    });

    it("should calculate base experiment completion", () => {
      const experimentData = {
        experiment_id: "EXP-001",
        experiment_type: "baseline",
        description: "Test experiment",
        spatial_coverage: { geo: { box: "0 0 10 10" } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -100 },
        investigators: [{ name: "Dr. Test" }],
        start_datetime: "2024-01-01 00:00:00",
        end_datetime: "2024-12-31 23:59:59"
      };

      const result = calculateFormCompletion(experimentData, "baseline");
      expect(result).toBe(100);
    });

    it("should calculate intervention experiment completion", () => {
      const experimentData = {
        // Base fields
        experiment_id: "EXP-001",
        experiment_type: "intervention",
        description: "Test intervention",
        spatial_coverage: { geo: { box: "0 0 10 10" } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -100 },
        investigators: [{ name: "Dr. Test" }],
        start_datetime: "2024-01-01 00:00:00",
        end_datetime: "2024-12-31 23:59:59",
        // Intervention-specific fields
        alkalinity_feedstock_processing: "grinding",
        alkalinity_feedstock_form: "powder",
        alkalinity_feedstock: "olivine",
        alkalinity_feedstock_description: "Test feedstock",
        equilibration: "pre-equilibrated",
        dosing_location: { geo: { point: { latitude: 0, longitude: 0 } } },
        dosing_dispersal_hydrologic_location: "surface",
        dosing_delivery_type: "continuous",
        alkalinity_dosing_effluent_density: 1000,
        dosing_depth: { min_depth_in_m: 0, max_depth_in_m: -10 },
        dosing_description: "Test dosing",
        dosing_regimen: "Daily",
        dosing_data: { some: "data" }
      };

      const result = calculateFormCompletion(experimentData, "intervention");
      expect(result).toBe(100);
    });

    it("should handle tracer study type", () => {
      const experimentData = {
        experiment_id: "EXP-001",
        experiment_type: "tracer_study",
        description: "Test tracer",
        spatial_coverage: { geo: { box: "0 0 10 10" } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -100 },
        investigators: [{ name: "Dr. Test" }],
        start_datetime: "2024-01-01 00:00:00",
        end_datetime: "2024-12-31 23:59:59",
        tracer_concentration: 100,
        tracer_details: "Test tracer",
        tracer_form: "liquid",
        dosing_delivery_type: "continuous",
        dosing_depth: { min_depth_in_m: 0 },
        dosing_description: "Test",
        dosing_dispersal_hydrologic_location: "surface",
        dosing_location: { geo: { point: { latitude: 0, longitude: 0 } } },
        dosing_regimen: "Daily"
      };

      const result = calculateFormCompletion(experimentData, "tracer_study");
      expect(result).toBe(100);
    });

    it("should handle intervention_with_tracer type", () => {
      // This type should require both intervention and tracer fields
      const experimentData = {
        experiment_id: "EXP-001",
        experiment_type: "intervention_with_tracer"
        // Missing all other fields
      };

      const result = calculateFormCompletion(
        experimentData,
        "intervention_with_tracer"
      );
      expect(result).toBeLessThan(10); // Very low completion
    });

    it("should count numbers as filled and use base fields when no type specified", () => {
      const data = {
        experiment_id: "test-123",
        experiment_type: "baseline",
        description: "Test experiment",
        vertical_coverage: { min_depth_in_m: 0 }, // Number zero should count
        empty_string: ""
      };

      const result = calculateFormCompletion(data);
      // 4 out of 8 base fields filled (experiment_id, experiment_type, description, vertical_coverage)
      expect(result).toBe(50);
    });
  });
});
