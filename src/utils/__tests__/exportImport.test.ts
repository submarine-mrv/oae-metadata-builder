import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportMetadata, importMetadata } from '../exportImport';
import type { ExperimentData } from '@/contexts/AppStateContext';

// Mock schemaViews
vi.mock('../schemaViews', () => ({
  getProtocolMetadata: () => ({
    version: 'v1.0.0-test',
    gitHash: 'a'.repeat(40)
  })
}));

describe('Export/Import', () => {
  describe('exportMetadata', () => {
    let createObjectURLSpy: any;
    let revokeObjectURLSpy: any;
    let createElementSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;

    beforeEach(() => {
      // Mock DOM APIs for download
      createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation();
      createElementSpy = vi.spyOn(document, 'createElement');
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation();
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation();
    });

    afterEach(() => {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should wrap data in Container format with version metadata', () => {
      const projectData = {
        project_id: 'test-project',
        project_description: 'Test description',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        spatial_coverage: { geo: { box: '0 0 1 1' } },
        temporal_coverage: '2024-01-01/2024-12-31'
      };

      const experiments: ExperimentData[] = [
        {
          id: 1,
          name: 'Experiment 1',
          formData: {
            experiment_id: 'exp-001',
            experiment_type: 'baseline',
            description: 'Test experiment'
          },
          experiment_type: 'baseline',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      exportMetadata(projectData, experiments);

      // Verify Blob was created with Container format
      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      expect(blobCall).toBeDefined();

      const blobContent = blobCall[0][0];
      const exportedData = JSON.parse(blobContent);

      // Should have Container structure
      expect(exportedData).toHaveProperty('version');
      expect(exportedData).toHaveProperty('protocol_git_hash');
      expect(exportedData).toHaveProperty('metadata_builder_git_hash');
      expect(exportedData).toHaveProperty('project');

      // Should have protocol metadata
      expect(exportedData.version).toBe('v1.0.0-test');
      expect(exportedData.protocol_git_hash).toBe('a'.repeat(40));

      // Project should contain project data + experiments
      expect(exportedData.project.project_id).toBe('test-project');
      expect(exportedData.project.experiments).toHaveLength(1);
      expect(exportedData.project.experiments[0].experiment_id).toBe('exp-001');
    });

    it('should clean project data to only include valid fields', () => {
      const projectDataWithInvalidFields = {
        project_id: 'test-project',
        project_description: 'Description',
        mcdr_pathway: 'ocean_alkalinity_enhancement',
        // Invalid fields that should be removed
        experiment_id: 'should-be-removed',
        some_random_field: 'should-be-removed',
        alkalinity_feedstock: 'should-be-removed'
      };

      const experiments: ExperimentData[] = [];

      exportMetadata(projectDataWithInvalidFields, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const blobContent = blobCall[0][0];
      const exportedData = JSON.parse(blobContent);

      // Valid fields should be present
      expect(exportedData.project.project_id).toBe('test-project');
      expect(exportedData.project.project_description).toBe('Description');
      expect(exportedData.project.mcdr_pathway).toBe(
        'ocean_alkalinity_enhancement'
      );

      // Invalid fields should be removed
      expect(exportedData.project.experiment_id).toBeUndefined();
      expect(exportedData.project.some_random_field).toBeUndefined();
      expect(exportedData.project.alkalinity_feedstock).toBeUndefined();
    });

    it('should include only experiment formData in export', () => {
      const projectData = {
        project_id: 'test-project',
        project_description: 'Test'
      };

      const experiments: ExperimentData[] = [
        {
          id: 1,
          name: 'Experiment Name',
          formData: {
            experiment_id: 'exp-001',
            experiment_type: 'baseline',
            description: 'Exp description'
          },
          experiment_type: 'baseline',
          createdAt: 123456,
          updatedAt: 789012
        }
      ];

      exportMetadata(projectData, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const blobContent = blobCall[0][0];
      const exportedData = JSON.parse(blobContent);

      const exportedExperiment = exportedData.project.experiments[0];

      // Should only have formData fields
      expect(exportedExperiment.experiment_id).toBe('exp-001');
      expect(exportedExperiment.experiment_type).toBe('baseline');
      expect(exportedExperiment.description).toBe('Exp description');

      // Should NOT have ExperimentData wrapper fields
      expect(exportedExperiment.id).toBeUndefined();
      expect(exportedExperiment.name).toBeUndefined();
      expect(exportedExperiment.createdAt).toBeUndefined();
      expect(exportedExperiment.updatedAt).toBeUndefined();
    });

    it('should generate filename with project_id and timestamp', () => {
      const projectData = {
        project_id: 'my-test-project',
        project_description: 'Test'
      };

      const experiments: ExperimentData[] = [];

      // Mock date to get consistent timestamp
      const mockDate = new Date('2024-03-15T10:30:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      exportMetadata(projectData, experiments);

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value?.tagName === 'A'
      )?.value as HTMLAnchorElement;

      expect(linkElement).toBeDefined();
      expect(linkElement.download).toBe('my-test-project-metadata-2024-03-15.json');

      vi.mocked(global.Date).mockRestore();
    });

    it('should use "project" as default filename when project_id is missing', () => {
      const projectData = {
        project_description: 'Test without ID'
      };

      const experiments: ExperimentData[] = [];

      const mockDate = new Date('2024-03-15T10:30:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      exportMetadata(projectData, experiments);

      const linkElement = createElementSpy.mock.results.find(
        (result) => result.value?.tagName === 'A'
      )?.value as HTMLAnchorElement;

      expect(linkElement.download).toBe('project-metadata-2024-03-15.json');

      vi.mocked(global.Date).mockRestore();
    });

    it('should create blob with correct type', () => {
      const projectData = { project_id: 'test' };
      const experiments: ExperimentData[] = [];

      exportMetadata(projectData, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const options = blobCall[1];

      expect(options).toEqual({ type: 'application/json' });
    });

    it('should properly format JSON with 2-space indentation', () => {
      const projectData = {
        project_id: 'test-project',
        project_description: 'Test'
      };

      const experiments: ExperimentData[] = [];

      exportMetadata(projectData, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const blobContent = blobCall[0][0];

      // Should have proper indentation (2 spaces)
      expect(blobContent).toContain('\n  "version"');
      expect(blobContent).toContain('\n  "project"');
    });

    it('should handle empty experiments array', () => {
      const projectData = {
        project_id: 'test-project',
        project_description: 'Test'
      };

      const experiments: ExperimentData[] = [];

      exportMetadata(projectData, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const blobContent = blobCall[0][0];
      const exportedData = JSON.parse(blobContent);

      expect(exportedData.project.experiments).toEqual([]);
    });

    it('should handle multiple experiments', () => {
      const projectData = {
        project_id: 'test-project',
        project_description: 'Test'
      };

      const experiments: ExperimentData[] = [
        {
          id: 1,
          name: 'Exp 1',
          formData: {
            experiment_id: 'exp-001',
            experiment_type: 'baseline'
          },
          experiment_type: 'baseline',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 2,
          name: 'Exp 2',
          formData: {
            experiment_id: 'exp-002',
            experiment_type: 'intervention'
          },
          experiment_type: 'intervention',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      exportMetadata(projectData, experiments);

      const blobCall = vi.mocked(global.Blob).mock.calls[0];
      const blobContent = blobCall[0][0];
      const exportedData = JSON.parse(blobContent);

      expect(exportedData.project.experiments).toHaveLength(2);
      expect(exportedData.project.experiments[0].experiment_id).toBe('exp-001');
      expect(exportedData.project.experiments[1].experiment_id).toBe('exp-002');
    });
  });

  describe('importMetadata', () => {
    it('should parse Container format and extract project data', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'b'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'imported-project',
          project_description: 'Imported description',
          mcdr_pathway: 'ocean_alkalinity_enhancement',
          spatial_coverage: { geo: { box: '0 0 1 1' } },
          temporal_coverage: '2024-01-01/2024-12-31',
          experiments: []
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.projectData.project_id).toBe('imported-project');
      expect(result.projectData.project_description).toBe('Imported description');
      expect(result.projectData.mcdr_pathway).toBe('ocean_alkalinity_enhancement');
      expect(result.experiments).toEqual([]);
    });

    it('should extract experiments from Container format', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'c'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test-project',
          project_description: 'Test',
          experiments: [
            {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'Baseline experiment'
            },
            {
              experiment_id: 'exp-002',
              experiment_type: 'intervention',
              description: 'Intervention experiment'
            }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.experiments).toHaveLength(2);
      expect(result.experiments[0].formData.experiment_id).toBe('exp-001');
      expect(result.experiments[0].formData.experiment_type).toBe('baseline');
      expect(result.experiments[1].formData.experiment_id).toBe('exp-002');
      expect(result.experiments[1].formData.experiment_type).toBe('intervention');
    });

    it('should convert experiments to ExperimentData format with ids', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'd'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test',
          experiments: [
            {
              experiment_id: 'exp-001',
              experiment_type: 'baseline'
            }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      const experiment = result.experiments[0];

      // Should have ExperimentData structure
      expect(experiment).toHaveProperty('id');
      expect(experiment).toHaveProperty('name');
      expect(experiment).toHaveProperty('formData');
      expect(experiment).toHaveProperty('experiment_type');
      expect(experiment).toHaveProperty('createdAt');
      expect(experiment).toHaveProperty('updatedAt');

      expect(experiment.id).toBe(1);
      expect(experiment.experiment_type).toBe('baseline');
    });

    it('should use experiment_id as name if name is not provided', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'e'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test',
          experiments: [
            {
              experiment_id: 'my-experiment-001',
              experiment_type: 'baseline'
            }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.experiments[0].name).toBe('my-experiment-001');
    });

    it('should use default name if neither name nor experiment_id is provided', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'f'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test',
          experiments: [
            {
              experiment_type: 'baseline',
              description: 'No ID or name'
            }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.experiments[0].name).toBe('Experiment 1');
    });

    it('should remove experiments array from project data', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'g'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test-project',
          project_description: 'Test',
          experiments: [
            {
              experiment_id: 'exp-001',
              experiment_type: 'baseline'
            }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      // Project data should NOT have experiments array
      expect(result.projectData.experiments).toBeUndefined();

      // Experiments should be in separate array
      expect(result.experiments).toHaveLength(1);
    });

    it('should clean project data to only include valid fields', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'h'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test-project',
          project_description: 'Test',
          // Invalid fields that should be removed
          invalid_field: 'should-be-removed',
          another_invalid: 123,
          experiments: []
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      // Valid fields should be present
      expect(result.projectData.project_id).toBe('test-project');
      expect(result.projectData.project_description).toBe('Test');

      // Invalid fields should be removed
      expect(result.projectData.invalid_field).toBeUndefined();
      expect(result.projectData.another_invalid).toBeUndefined();
    });

    it('should handle missing project key in Container', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'i'.repeat(40),
        metadata_builder_git_hash: ''
        // Missing 'project' key
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      // Should return empty project data and experiments
      expect(result.projectData).toEqual({});
      expect(result.experiments).toEqual([]);
    });

    it('should handle missing experiments array', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'j'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test-project',
          project_description: 'Test'
          // Missing 'experiments' array
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.projectData.project_id).toBe('test-project');
      expect(result.experiments).toEqual([]);
    });

    it('should reject invalid JSON', async () => {
      const invalidJson = '{ this is not valid JSON }';
      const file = new File([invalidJson], 'test.json', {
        type: 'application/json'
      });

      await expect(importMetadata(file)).rejects.toThrow(
        /Failed to parse JSON file/
      );
    });

    it('should reject file read errors', async () => {
      // Create a file that will cause a read error
      const file = new File(['test'], 'test.json', { type: 'application/json' });

      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader;
      global.FileReader = class MockFileReader {
        readAsText() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Mock read error') as any);
            }
          }, 0);
        }
      } as any;

      await expect(importMetadata(file)).rejects.toThrow('Failed to read file');

      global.FileReader = originalFileReader;
    });

    it('should assign sequential ids to experiments', async () => {
      const containerData = {
        version: 'v1.0.0',
        protocol_git_hash: 'k'.repeat(40),
        metadata_builder_git_hash: '',
        project: {
          project_id: 'test',
          experiments: [
            { experiment_id: 'exp-001', experiment_type: 'baseline' },
            { experiment_id: 'exp-002', experiment_type: 'control' },
            { experiment_id: 'exp-003', experiment_type: 'intervention' }
          ]
        }
      };

      const jsonString = JSON.stringify(containerData);
      const file = new File([jsonString], 'test.json', {
        type: 'application/json'
      });

      const result = await importMetadata(file);

      expect(result.experiments[0].id).toBe(1);
      expect(result.experiments[1].id).toBe(2);
      expect(result.experiments[2].id).toBe(3);
    });
  });
});
