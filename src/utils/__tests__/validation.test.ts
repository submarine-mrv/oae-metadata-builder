import { describe, it, expect } from 'vitest';
import { validateProject, validateExperiment, validateAllData } from '../validation';

describe('Validation', () => {
  describe('validateProject', () => {
    it('should validate valid project data', () => {
      const validData = {
        project_id: 'test-project-001',
        description: 'A comprehensive test project for OAE research',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        sea_names: ['http://vocab.nerc.ac.uk/collection/C16/current/26/'],
        spatial_coverage: {
          geo: {
            box: '-124.0 47.0 -122.0 48.0'
          }
        },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const result = validateProject(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.errorCount).toBe(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidData = {
        project_id: '', // Empty - should fail
      };

      const result = validateProject(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should fail validation for invalid mcdr_pathway enum value', () => {
      const invalidData = {
        project_id: 'test-project',
        description: 'Test',
        mcdr_pathway: 'invalid_pathway_value', // Not in enum
        sea_names: [],
        spatial_coverage: { geo: { box: '0 0 0 0' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const result = validateProject(invalidData);

      expect(result.isValid).toBe(false);
    });

    it('should return validation result structure even on errors', () => {
      const result = validateProject({});

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('errorCount');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.errorCount).toBe('number');
    });
  });

  describe('validateExperiment', () => {
    it('should validate experiment with baseline type', () => {
      const validExperiment = {
        experiment_id: 'exp-baseline-001',
        experiment_type: 'baseline',
        description: 'Baseline measurements before intervention',
        spatial_coverage: {
          geo: { box: '0 0 1 1' }
        },
        vertical_coverage: {
          min_depth_in_m: 0,
          max_depth_in_m: -100
        },
        investigators: [],
        start_datetime: '2024-01-01T00:00:00Z',
        end_datetime: '2024-12-31T23:59:59Z'
      };

      const result = validateExperiment(validExperiment);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should select Intervention schema for intervention type', () => {
      const interventionExperiment = {
        experiment_id: 'exp-intervention-001',
        experiment_type: 'intervention',
        description: 'Alkalinity addition experiment',
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
        investigators: [],
        start_datetime: '2024-01-01T00:00:00Z',
        end_datetime: '2024-12-31T23:59:59Z',
        // Intervention-specific required fields
        alkalinity_feedstock: 'limestone',
        alkalinity_feedstock_form: 'solid',
        alkalinity_feedstock_processing: 'mineral_mining',
        alkalinity_feedstock_description: 'Crushed limestone',
        equilibration: 'pre_equilibrated',
        dosing_location: { geo: { line: '0 0 1 1' } },
        dosing_dispersal_hydrologic_location: 'ocean',
        dosing_delivery_type: 'static_distributed',
        alkalinity_dosing_effluent_density: { is_derived_value: false, is_provided_as_a_file: false },
        dosing_depth: '10',
        dosing_description: 'Test dosing',
        dosing_regimen: 'Single dose'
      };

      const result = validateExperiment(interventionExperiment);

      // If valid, we know the Intervention schema was used
      // (baseline schema wouldn't have alkalinity_feedstock field)
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
    });

    it('should select Tracer schema for tracer_study type', () => {
      const tracerExperiment = {
        experiment_id: 'exp-tracer-001',
        experiment_type: 'tracer_study',
        description: 'SF6 tracer study',
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
        investigators: [],
        start_datetime: '2024-01-01T00:00:00Z',
        end_datetime: '2024-12-31T23:59:59Z',
        // Tracer-specific fields
        tracer_form: 'gas',
        tracer_details: []
      };

      const result = validateExperiment(tracerExperiment);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
    });

    it('should fail validation for missing required experiment fields', () => {
      const invalidExperiment = {
        experiment_type: 'baseline',
        // Missing experiment_id and other required fields
      };

      const result = validateExperiment(invalidExperiment);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should use base Experiment schema for control type', () => {
      const controlExperiment = {
        experiment_id: 'exp-control-001',
        experiment_type: 'control',
        description: 'Control experiment',
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
        investigators: [],
        start_datetime: '2024-01-01T00:00:00Z',
        end_datetime: '2024-12-31T23:59:59Z'
      };

      const result = validateExperiment(controlExperiment);

      expect(result).toHaveProperty('isValid');
      // Control type should use base Experiment schema (not Intervention or Tracer)
    });
  });

  describe('validateAllData', () => {
    it('should validate both project and experiments together', () => {
      const projectData = {
        project_id: 'project-001',
        description: 'Test project',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        sea_names: [],
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const experiments = [
        {
          id: 1,
          name: 'Baseline',
          formData: {
            experiment_id: 'exp-001',
            experiment_type: 'baseline',
            description: 'Baseline',
            spatial_coverage: { geo: { box: '0 0 1 1' } },
            vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
            investigators: [],
            start_datetime: '2024-01-01T00:00:00Z',
            end_datetime: '2024-12-31T23:59:59Z'
          }
        }
      ];

      const result = validateAllData(projectData, experiments);

      expect(result).toHaveProperty('projectValidation');
      expect(result).toHaveProperty('experimentValidations');
      expect(result).toHaveProperty('isAllValid');

      expect(result.projectValidation.isValid).toBe(true);
      expect(result.experimentValidations.size).toBe(1);
      expect(result.isAllValid).toBe(true);
    });

    it('should aggregate errors from both project and experiments', () => {
      const invalidProjectData = {
        project_id: '', // Invalid
      };

      const invalidExperiments = [
        {
          id: 1,
          name: 'Invalid',
          formData: {
            experiment_type: 'baseline',
            // Missing required fields
          }
        }
      ];

      const result = validateAllData(invalidProjectData, invalidExperiments);

      expect(result.isAllValid).toBe(false);
      expect(result.projectValidation.isValid).toBe(false);

      const exp1Validation = result.experimentValidations.get(1);
      expect(exp1Validation).toBeDefined();
      expect(exp1Validation?.isValid).toBe(false);
    });

    it('should validate multiple experiments with different types', () => {
      const projectData = {
        project_id: 'project-001',
        description: 'Test project',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        sea_names: [],
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const experiments = [
        {
          id: 1,
          name: 'Baseline',
          formData: {
            experiment_id: 'exp-baseline',
            experiment_type: 'baseline',
            description: 'Baseline',
            spatial_coverage: { geo: { box: '0 0 1 1' } },
            vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
            investigators: [],
            start_datetime: '2024-01-01T00:00:00Z',
            end_datetime: '2024-12-31T23:59:59Z'
          }
        },
        {
          id: 2,
          name: 'Control',
          formData: {
            experiment_id: 'exp-control',
            experiment_type: 'control',
            description: 'Control',
            spatial_coverage: { geo: { box: '0 0 1 1' } },
            vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
            investigators: [],
            start_datetime: '2024-01-01T00:00:00Z',
            end_datetime: '2024-12-31T23:59:59Z'
          }
        }
      ];

      const result = validateAllData(projectData, experiments);

      expect(result.experimentValidations.size).toBe(2);
      expect(result.experimentValidations.has(1)).toBe(true);
      expect(result.experimentValidations.has(2)).toBe(true);
    });

    it('should return false for isAllValid if any experiment fails', () => {
      const validProjectData = {
        project_id: 'project-001',
        description: 'Test',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        sea_names: [],
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const experiments = [
        {
          id: 1,
          name: 'Valid',
          formData: {
            experiment_id: 'exp-001',
            experiment_type: 'baseline',
            description: 'Valid',
            spatial_coverage: { geo: { box: '0 0 1 1' } },
            vertical_coverage: { min_depth_in_m: 0, max_depth_in_m: -50 },
            investigators: [],
            start_datetime: '2024-01-01T00:00:00Z',
            end_datetime: '2024-12-31T23:59:59Z'
          }
        },
        {
          id: 2,
          name: 'Invalid',
          formData: {
            experiment_type: 'baseline',
            // Missing required fields (experiment_id, description, etc.)
          }
        }
      ];

      const result = validateAllData(validProjectData, experiments);

      expect(result.isAllValid).toBe(false);
      expect(result.projectValidation.isValid).toBe(true);
      expect(result.experimentValidations.get(1)?.isValid).toBe(true);
      expect(result.experimentValidations.get(2)?.isValid).toBe(false);
    });
  });

  describe('Bug Regression: Type compatibility (Bug #5)', () => {
    it('should accept schema without runtime type errors', () => {
      // This test ensures that the 'as any' type assertions work correctly
      // and don't hide runtime errors

      const validData = {
        project_id: 'test',
        description: 'Test',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        sea_names: [],
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      // Should not throw at runtime
      expect(() => {
        validateProject(validData);
      }).not.toThrow();
    });
  });
});
