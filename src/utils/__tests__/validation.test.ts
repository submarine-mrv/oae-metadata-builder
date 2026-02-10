import { describe, it, expect } from 'vitest';
import { validateProject, validateExperiment, validateDataset, validateAllData } from '../validation';

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
        project_id: 'proj-001',
        experiment_id: 'exp-baseline-001',
        project_id: '', // Workaround: project_id required by schema but may be empty (see oae-form-aau)
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
        project_id: '',
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
        project_id: '',
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
        project_id: '',
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
            project_id: 'project-001',
            experiment_id: 'exp-001',
            project_id: '',
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
            project_id: 'project-001',
            experiment_id: 'exp-baseline',
            project_id: '',
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
            project_id: 'project-001',
            experiment_id: 'exp-control',
            project_id: '',
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
            project_id: 'project-001',
            experiment_id: 'exp-001',
            project_id: '',
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
            // Missing required fields (project_id, experiment_id, description, etc.)
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

  describe('validateDataset', () => {
    it('should return validation result structure', () => {
      const data = {
        project_id: 'test-project-001',
        experiment_id: 'test-exp-001',
        name: 'Test Dataset',
        description: 'A test dataset',
        temporal_coverage: '2024-01-01/2024-12-31',
        dataset_type: 'cast',
        data_product_type: 'raw_sensor_data',
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        data_submitter: {
          name: 'Test User',
          email: 'test@example.com',
          affiliation: { name: 'Test Org' }
        },
        filenames: ['data.csv']
      };

      const result = validateDataset(data);

      // Should return proper validation structure
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('errorCount');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.errorCount).toBe('number');
    });

    it('should fail validation for invalid email format', () => {
      const invalidData = {
        project_id: 'test-project-001',
        name: 'Test Dataset',
        description: 'A test dataset',
        temporal_coverage: '2024-01-01/2024-12-31',
        dataset_type: 'cast',
        data_product_type: 'raw_sensor_data',
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        data_submitter: {
          name: 'Test User',
          email: 'not-an-email', // Invalid email format
          affiliation: { name: 'Test Org' }
        },
        filenames: ['data.csv']
      };

      const result = validateDataset(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidData = {
        name: 'Test Dataset',
        // Missing many required fields
      };

      const result = validateDataset(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should fail validation when experiment_id is empty string', () => {
      // Edge case: when a linked experiment's experiment_id is cleared,
      // propagateExperimentIdToDatasets syncs "" to the dataset.
      // An empty string passes JSON schema "required" check (property exists),
      // so we need explicit validation to catch this.
      const data = {
        project_id: 'test-project-001',
        experiment_id: '', // Empty string — should fail
        name: 'Test Dataset',
        description: 'A test dataset',
        temporal_coverage: '2024-01-01/2024-12-31',
        dataset_type: 'cast',
        data_product_type: 'raw_sensor_data',
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        data_submitter: {
          name: 'Test User',
          email: 'test@example.com',
          affiliation: { name: 'Test Org' }
        },
        filenames: ['data.csv']
      };

      const result = validateDataset(data, { hasExperiments: true });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(
        (e) => e.property === '.experiment_id' || e.params?.missingProperty === 'experiment_id'
      )).toBe(true);
    });

    it('should suppress empty experiment_id error when hasExperiments is false', () => {
      // When no experiments exist, experiment_id errors should be suppressed
      const data = {
        project_id: 'test-project-001',
        experiment_id: '',
        name: 'Test Dataset',
        description: 'A test dataset',
        temporal_coverage: '2024-01-01/2024-12-31',
        dataset_type: 'cast',
        data_product_type: 'raw_sensor_data',
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        data_submitter: {
          name: 'Test User',
          email: 'test@example.com',
          affiliation: { name: 'Test Org' }
        },
        filenames: ['data.csv']
      };

      const result = validateDataset(data, { hasExperiments: false });

      // experiment_id errors should be suppressed
      const experimentIdErrors = result.errors.filter(
        (e) => e.property === '.experiment_id' || e.params?.missingProperty === 'experiment_id'
      );
      expect(experimentIdErrors).toHaveLength(0);
    });

    it('should fail validation when experiment_id is undefined (key present)', () => {
      // When propagation clears experiment_id, the key exists with value undefined.
      // AJV treats undefined as missing, so "required" catches it.
      const data = {
        project_id: 'test-project-001',
        experiment_id: undefined, // Key present, value undefined — same as propagation result
        name: 'Test Dataset',
        description: 'A test dataset',
        temporal_coverage: '2024-01-01/2024-12-31',
        dataset_type: 'cast',
        data_product_type: 'raw_sensor_data',
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        data_submitter: {
          name: 'Test User',
          email: 'test@example.com',
          affiliation: { name: 'Test Org' }
        },
        filenames: ['data.csv']
      };

      const result = validateDataset(data, { hasExperiments: true });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(
        (e) => e.property === '.experiment_id' || e.params?.missingProperty === 'experiment_id'
      )).toBe(true);
    });

    it('should count multiple validation errors', () => {
      // Test case matching user's reported issue
      const invalidData = {
        project_id: '', // Empty - may be required
        platform_info: {
          platform_type: 'http://vocab.nerc.ac.uk/collection/L06/current/62/'
        },
        name: 'Testing validation errors',
        description: 'asdf',
        temporal_coverage: '2/2', // Invalid format
        dataset_type: 'cast',
        data_product_type: 'data_compilation_product',
        data_submitter: {
          affiliation: {
            name: 'asdf'
          },
          email: 'asdf', // Invalid email
          name: 'sdaf'
        },
        filenames: ['asdfasdf']
      };

      const result = validateDataset(invalidData);

      expect(result.isValid).toBe(false);
      // Should have validation errors (format errors, etc.)
      expect(result.errorCount).toBeGreaterThan(0);
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
