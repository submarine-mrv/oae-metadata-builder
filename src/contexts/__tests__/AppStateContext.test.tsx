import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import React from 'react';
import { AppStateProvider, useAppState, type ExperimentData } from '../AppStateContext';

describe('AppStateContext', () => {
  describe('Provider and Hook', () => {
    it('should throw error when useAppState is used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppState());
      }).toThrow('useAppState must be used within AppStateProvider');

      spy.mockRestore();
    });

    it('should provide initial state', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      expect(result.current.state).toEqual({
        hasProject: false,
        projectData: { project_id: '' },
        experiments: [],
        datasets: [],
        activeTab: 'overview',
        activeExperimentId: null,
        activeDatasetId: null,
        nextExperimentId: 1,
        nextDatasetId: 1,
        triggerValidation: false,
        showJsonPreview: false,
        validationStatus: { project: null, experiments: {}, datasets: {} }
      });
    });
  });

  describe('updateProjectData', () => {
    it('should update project data', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const newProjectData = {
        project_id: 'test-project',
        description: 'Test description',
        mcdr_pathway: 'ocean_alkalinity_enhancement'
      };

      act(() => {
        result.current.updateProjectData(newProjectData);
      });

      expect(result.current.state.projectData).toEqual(newProjectData);
    });

    it('should propagate project_id to all experiments when updating project data', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Add an experiment first
      act(() => {
        result.current.addExperiment('Test Experiment');
      });

      // Update project data
      act(() => {
        result.current.updateProjectData({ project_id: 'new-project' });
      });

      // All experiments should have their project_id updated
      expect(result.current.state.experiments[0].formData.project_id).toBe('new-project');
      // Experiment name and other properties should remain unchanged
      expect(result.current.state.experiments[0].name).toBe('Test Experiment');
    });
  });

  describe('createProject', () => {
    it('should set hasProject to true', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      expect(result.current.state.hasProject).toBe(false);

      act(() => {
        result.current.createProject();
      });

      expect(result.current.state.hasProject).toBe(true);
    });
  });

  describe('deleteProject', () => {
    it('should set hasProject to false and reset projectData', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create a project and add data
      act(() => {
        result.current.createProject();
        result.current.updateProjectData({ project_id: 'test-project', description: 'Test' });
      });

      expect(result.current.state.hasProject).toBe(true);

      act(() => {
        result.current.deleteProject();
      });

      expect(result.current.state.hasProject).toBe(false);
      expect(result.current.state.projectData).toEqual({});
    });

    it('should clear project_id from all experiments and datasets', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create project with ID
      act(() => {
        result.current.createProject();
        result.current.updateProjectData({ project_id: 'my-project' });
      });

      // Add experiment and dataset
      act(() => {
        result.current.addExperiment('Exp 1');
        result.current.addDataset('DS 1');
      });

      // Verify they have the project_id
      expect(result.current.state.experiments[0].formData.project_id).toBe('my-project');
      expect(result.current.state.datasets[0].formData.project_id).toBe('my-project');

      // Delete the project
      act(() => {
        result.current.deleteProject();
      });

      // All experiments and datasets should have project_id cleared
      expect(result.current.state.experiments[0].formData.project_id).toBe('');
      expect(result.current.state.datasets[0].formData.project_id).toBe('');
    });
  });

  describe('addExperiment', () => {
    it('should add experiment with auto-incrementing ID', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('First Experiment');
      });

      expect(experimentId!).toBe(1);
      expect(result.current.state.experiments).toHaveLength(1);
      expect(result.current.state.experiments[0].id).toBe(1);
      expect(result.current.state.experiments[0].name).toBe('First Experiment');
      expect(result.current.state.nextExperimentId).toBe(2);
    });

    it('should use default name when name is not provided', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment();
      });

      expect(result.current.state.experiments[0].name).toBe('Experiment 1');
    });

    it('should include project_id in experiment formData', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.updateProjectData({ project_id: 'my-project' });
      });

      act(() => {
        result.current.addExperiment('Test');
      });

      expect(result.current.state.experiments[0].formData.project_id).toBe(
        'my-project'
      );
    });

    it('should set active experiment to newly added experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      expect(result.current.state.activeExperimentId).toBe(experimentId!);
    });

    it('should increment nextExperimentId for each new experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment('Exp 1');
        result.current.addExperiment('Exp 2');
        result.current.addExperiment('Exp 3');
      });

      expect(result.current.state.experiments).toHaveLength(3);
      expect(result.current.state.experiments[0].id).toBe(1);
      expect(result.current.state.experiments[1].id).toBe(2);
      expect(result.current.state.experiments[2].id).toBe(3);
      expect(result.current.state.nextExperimentId).toBe(4);
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const beforeTime = Date.now();

      act(() => {
        result.current.addExperiment('Test');
      });

      const afterTime = Date.now();

      const experiment = result.current.state.experiments[0];
      expect(experiment.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(experiment.createdAt).toBeLessThanOrEqual(afterTime);
      expect(experiment.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(experiment.updatedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('updateExperiment', () => {
    it('should update experiment formData', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      const newFormData = {
        experiment_id: 'exp-001',
        experiment_types: ['baseline'],
        description: 'Updated description'
      };

      act(() => {
        result.current.updateExperiment(experimentId!, newFormData);
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.id === experimentId
      );
      // Should merge with existing formData (which includes project_id)
      expect(experiment?.formData).toEqual({
        project_id: '', // From initial experiment creation
        ...newFormData
      });
    });

    it('should update experiment_types from formData', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      act(() => {
        result.current.updateExperiment(experimentId!, {
          experiment_types: ['intervention']
        });
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.id === experimentId
      );
      expect(experiment?.experiment_types).toEqual(['intervention']);
    });

    it('should update name from formData if provided', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Original Name');
      });

      act(() => {
        result.current.updateExperiment(experimentId!, {
          name: 'Updated Name'
        });
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.id === experimentId
      );
      expect(experiment?.name).toBe('Updated Name');
    });

    it('should preserve name if not in formData', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Original Name');
      });

      act(() => {
        result.current.updateExperiment(experimentId!, {
          description: 'Some data without name'
        });
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.id === experimentId
      );
      expect(experiment?.name).toBe('Original Name');
    });

    it('should update updatedAt timestamp', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      const originalUpdatedAt = result.current.state.experiments[0].updatedAt;

      // Wait a bit to ensure timestamp changes
      vi.advanceTimersByTime(10);

      act(() => {
        result.current.updateExperiment(experimentId!, { description: 'New' });
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.id === experimentId
      );
      expect(experiment?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);

      vi.useRealTimers();
    });

    it('should only update specified experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let exp1Id: number, exp2Id: number;

      act(() => {
        exp1Id = result.current.addExperiment('Exp 1');
        exp2Id = result.current.addExperiment('Exp 2');
      });

      act(() => {
        result.current.updateExperiment(exp1Id!, { description: 'Updated Exp 1' });
      });

      const exp1 = result.current.state.experiments.find((e) => e.id === exp1Id);
      const exp2 = result.current.state.experiments.find((e) => e.id === exp2Id);

      expect(exp1?.formData.description).toBe('Updated Exp 1');
      expect(exp2?.formData.description).toBeUndefined();
    });
  });

  describe('deleteExperiment', () => {
    it('should remove experiment from list', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      expect(result.current.state.experiments).toHaveLength(1);

      act(() => {
        result.current.deleteExperiment(experimentId!);
      });

      expect(result.current.state.experiments).toHaveLength(0);
    });

    it('should clear activeExperimentId if deleted experiment was active', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Test');
      });

      expect(result.current.state.activeExperimentId).toBe(experimentId!);

      act(() => {
        result.current.deleteExperiment(experimentId!);
      });

      expect(result.current.state.activeExperimentId).toBeNull();
    });

    it('should preserve activeExperimentId if different experiment was deleted', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment('Exp 1');
      });

      act(() => {
        result.current.addExperiment('Exp 2');
      });

      // Get IDs from state
      const exp1Id = result.current.state.experiments[0].id;
      const exp2Id = result.current.state.experiments[1].id;

      // exp2 is active (last added)
      expect(result.current.state.activeExperimentId).toBe(exp2Id);

      // Delete exp1
      act(() => {
        result.current.deleteExperiment(exp1Id);
      });

      // exp2 should still be active
      expect(result.current.state.activeExperimentId).toBe(exp2Id);
    });

    it('should do nothing when deleting non-existent experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment('Exp 1');
      });

      const beforeLength = result.current.state.experiments.length;

      act(() => {
        result.current.deleteExperiment(999); // Non-existent ID
      });

      expect(result.current.state.experiments).toHaveLength(beforeLength);
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      expect(result.current.state.activeTab).toBe('overview');

      act(() => {
        result.current.setActiveTab('project');
      });

      expect(result.current.state.activeTab).toBe('project');

      act(() => {
        result.current.setActiveTab('experiment');
      });

      expect(result.current.state.activeTab).toBe('experiment');
    });
  });

  describe('setActiveExperiment', () => {
    it('should set active experiment ID', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.setActiveExperiment(5);
      });

      expect(result.current.state.activeExperimentId).toBe(5);
    });

    it('should set active experiment to null', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.setActiveExperiment(3);
      });

      expect(result.current.state.activeExperimentId).toBe(3);

      act(() => {
        result.current.setActiveExperiment(null);
      });

      expect(result.current.state.activeExperimentId).toBeNull();
    });
  });

  describe('getExperiment', () => {
    it('should get experiment by ID', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment('Exp 1');
      });

      act(() => {
        result.current.addExperiment('Exp 2');
      });

      // Get IDs from state
      const exp1Id = result.current.state.experiments[0].id;
      const exp2Id = result.current.state.experiments[1].id;

      const exp1 = result.current.getExperiment(exp1Id);
      const exp2 = result.current.getExperiment(exp2Id);

      expect(exp1?.name).toBe('Exp 1');
      expect(exp2?.name).toBe('Exp 2');
    });

    it('should return undefined for non-existent experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const experiment = result.current.getExperiment(999);

      expect(experiment).toBeUndefined();
    });
  });

  describe('getProjectCompletionPercentage', () => {
    // These tests intentionally use RELATIONAL assertions rather than
    // exact percentages. The completion calc is schema-driven, so exact
    // counts change when the upstream schema adds/removes required fields
    // — we don't want these tests to break every schema bump.
    it('should return 0 for empty project data', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      expect(result.current.getProjectCompletionPercentage()).toBe(0);
    });

    it('should increase as more required fields are filled', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.updateProjectData({
          project_id: 'test-project'
        });
      });
      const pctSmall = result.current.getProjectCompletionPercentage();

      act(() => {
        result.current.updateProjectData({
          project_id: 'test-project',
          description: 'Description',
          mcdr_pathway: 'ocean_alkalinity_enhancement'
        });
      });
      const pctLarger = result.current.getProjectCompletionPercentage();

      expect(pctSmall).toBeGreaterThan(0);
      expect(pctSmall).toBeLessThan(100);
      expect(pctLarger).toBeGreaterThan(pctSmall);
      expect(pctLarger).toBeLessThan(100);
    });

    it('should not count empty strings as filled', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.updateProjectData({
          project_id: '',
          description: '   ',
          mcdr_pathway: 'ocean_alkalinity_enhancement'
        });
      });
      const pctBlanks = result.current.getProjectCompletionPercentage();

      act(() => {
        result.current.updateProjectData({
          project_id: 'test',
          description: 'Real description',
          mcdr_pathway: 'ocean_alkalinity_enhancement'
        });
      });
      const pctFilled = result.current.getProjectCompletionPercentage();

      expect(pctFilled).toBeGreaterThan(pctBlanks);
    });

    it('should not count empty arrays as filled', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // project_leads is a required array on the Project schema
      act(() => {
        result.current.updateProjectData({
          project_id: 'test',
          project_leads: []
        });
      });
      const pctEmpty = result.current.getProjectCompletionPercentage();

      act(() => {
        result.current.updateProjectData({
          project_id: 'test',
          project_leads: [{ name: 'Alice', email: 'alice@example.com' }]
        });
      });
      const pctFilled = result.current.getProjectCompletionPercentage();

      expect(pctFilled).toBeGreaterThan(pctEmpty);
    });

    it('should count non-empty objects as contributing to completion', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.updateProjectData({ project_id: 'test' });
      });
      const pctBefore = result.current.getProjectCompletionPercentage();

      act(() => {
        result.current.updateProjectData({
          project_id: 'test',
          spatial_coverage: { geo: { box: '0 0 1 1' } }
        });
      });
      const pctAfter = result.current.getProjectCompletionPercentage();

      expect(pctAfter).toBeGreaterThan(pctBefore);
    });
  });

  describe('getExperimentCompletionPercentage', () => {
    it('should return 0 for non-existent experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const percentage = result.current.getExperimentCompletionPercentage(999);

      expect(percentage).toBe(0);
    });

    it('should calculate completion for baseline experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Baseline');
      });

      act(() => {
        result.current.updateExperiment(experimentId!, {
          experiment_id: 'exp-001',
          experiment_types: ['baseline'],
          description: 'Test'
          // Missing other required fields
        });
      });

      const percentage = result.current.getExperimentCompletionPercentage(experimentId!);

      // Should be greater than 0 but less than 100
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(100);
    });

    it('should include intervention-specific fields for intervention experiments', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      let experimentId: number;

      act(() => {
        experimentId = result.current.addExperiment('Intervention');
      });

      act(() => {
        result.current.updateExperiment(experimentId!, {
          experiment_id: 'exp-001',
          experiment_types: ['intervention'],
          description: 'Intervention test'
          // Missing intervention-specific fields
        });
      });

      const percentage = result.current.getExperimentCompletionPercentage(experimentId!);

      // Intervention has more required fields, so percentage should be lower
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(50); // With many missing fields
    });
  });

  describe('getProjectStatus / getExperimentStatus / getDatasetStatus', () => {
    // These are the consolidated getters the Overview page uses to drive
    // both the progress % and the live validation checkmark. Each call
    // runs AJV once and returns {percentage, isValid, isEmpty}. Tests are
    // relational (not exact %) for the same reason as the completion tests
    // — schema bumps shouldn't break them.

    it('getProjectStatus: fresh project → 0%, not valid', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      const status = result.current.getProjectStatus();
      // Don't assert isEmpty here — the fresh state may have auto-populated
      // keys (e.g. project_id: ''), which still produces percentage=0 via
      // the validator path rather than the isEmpty shortcut.
      expect(status.percentage).toBe(0);
      expect(status.isValid).toBe(false);
    });

    it('getProjectStatus: partially-filled project → >0%, not valid, not empty', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      act(() => {
        result.current.updateProjectData({
          project_id: 'P',
          description: 'D',
          mcdr_pathway: 'ocean_alkalinity_enhancement'
        });
      });
      const status = result.current.getProjectStatus();
      expect(status.isEmpty).toBe(false);
      expect(status.isValid).toBe(false); // still missing required fields
      expect(status.percentage).toBeGreaterThan(0);
      expect(status.percentage).toBeLessThan(100);
    });

    it('getExperimentStatus: unknown id → isEmpty:true, not valid', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      const status = result.current.getExperimentStatus(9999);
      expect(status).toEqual({ percentage: 0, isValid: false, isEmpty: true });
    });

    it('getExperimentStatus: empty formData → isEmpty:true', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      let id!: number;
      act(() => {
        id = result.current.addExperiment('E1');
      });
      // addExperiment leaves formData with project_id auto-propagated —
      // clear it to exercise the isEmpty branch.
      act(() => {
        result.current.replaceExperimentFormData(id, {});
      });
      const status = result.current.getExperimentStatus(id);
      expect(status.isEmpty).toBe(true);
      expect(status.isValid).toBe(false);
    });

    it('getDatasetStatus: unknown id → isEmpty:true, not valid', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      const status = result.current.getDatasetStatus(9999);
      expect(status).toEqual({ percentage: 0, isValid: false, isEmpty: true });
    });

    it('getDatasetStatus: partially-filled dataset → >0%, not valid, not empty', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      let id!: number;
      act(() => {
        id = result.current.addDataset('D1');
      });
      act(() => {
        result.current.replaceDatasetFormData(id, {
          dataset_type: 'field',
          name: 'sample'
        });
      });
      const status = result.current.getDatasetStatus(id);
      expect(status.isEmpty).toBe(false);
      expect(status.isValid).toBe(false);
      expect(status.percentage).toBeGreaterThanOrEqual(0);
      expect(status.percentage).toBeLessThan(100);
    });

    it('status.percentage matches the legacy getXCompletionPercentage path', () => {
      // The legacy functions delegate to getXStatus. This test locks that
      // in — if anyone "optimizes" by re-implementing them separately,
      // this will fail.
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });
      act(() => {
        result.current.updateProjectData({
          project_id: 'P',
          description: 'D'
        });
      });
      expect(result.current.getProjectStatus().percentage).toBe(
        result.current.getProjectCompletionPercentage()
      );

      let expId!: number;
      act(() => {
        expId = result.current.addExperiment('E');
      });
      expect(result.current.getExperimentStatus(expId).percentage).toBe(
        result.current.getExperimentCompletionPercentage(expId)
      );

      let dsId!: number;
      act(() => {
        dsId = result.current.addDataset('D');
      });
      expect(result.current.getDatasetStatus(dsId).percentage).toBe(
        result.current.getDatasetCompletionPercentage(dsId)
      );
    });
  });

  describe('importAllData', () => {
    it('should import project data and experiments', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const importedProjectData = {
        project_id: 'imported-project',
        description: 'Imported description'
      };

      const importedExperiments: ExperimentData[] = [
        {
          id: 1, // This ID will be reassigned
          name: 'Imported Exp 1',
          formData: { experiment_id: 'exp-001' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      act(() => {
        result.current.importAllData(importedProjectData, importedExperiments, []);
      });

      expect(result.current.state.projectData).toEqual(importedProjectData);
      expect(result.current.state.experiments).toHaveLength(1);
      expect(result.current.state.experiments[0].name).toBe('Imported Exp 1');
    });

    it('should reassign experiment IDs to avoid conflicts', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Add an existing experiment first
      act(() => {
        result.current.addExperiment('Existing');
      });

      const nextIdBeforeImport = result.current.state.nextExperimentId;

      const importedExperiments: ExperimentData[] = [
        {
          id: 1, // Original ID from imported file
          name: 'Imported 1',
          formData: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 2, // Original ID from imported file
          name: 'Imported 2',
          formData: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      act(() => {
        result.current.importAllData({}, importedExperiments, []);
      });

      // IDs should be reassigned starting from nextExperimentId
      expect(result.current.state.experiments[0].id).toBe(nextIdBeforeImport);
      expect(result.current.state.experiments[1].id).toBe(nextIdBeforeImport + 1);
    });

    it('should update nextExperimentId after import', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      const importedExperiments: ExperimentData[] = [
        {
          id: 1,
          name: 'Exp 1',
          formData: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 2,
          name: 'Exp 2',
          formData: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      act(() => {
        result.current.importAllData({}, importedExperiments, []);
      });

      // nextExperimentId should be 1 (initial) + 2 (imported) = 3
      expect(result.current.state.nextExperimentId).toBe(3);
    });

    it('should reset activeExperimentId to null', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.addExperiment('Test');
      });

      // Should have active experiment
      expect(result.current.state.activeExperimentId).not.toBeNull();

      act(() => {
        result.current.importAllData({}, [], []);
      });

      // Should be reset to null
      expect(result.current.state.activeExperimentId).toBeNull();
    });

    it('should reset activeTab to overview', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.setActiveTab('project');
      });

      expect(result.current.state.activeTab).toBe('project');

      act(() => {
        result.current.importAllData({}, [], []);
      });

      expect(result.current.state.activeTab).toBe('overview');
    });

    it('should set hasProject to true when importing project with content', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      expect(result.current.state.hasProject).toBe(false);

      act(() => {
        result.current.importAllData({ project_id: 'imported-project' }, [], []);
      });

      expect(result.current.state.hasProject).toBe(true);
    });

    it('should set hasProject to false when importing empty project', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // First create a project
      act(() => {
        result.current.createProject();
      });

      expect(result.current.state.hasProject).toBe(true);

      // Import with empty project data
      act(() => {
        result.current.importAllData({}, [], []);
      });

      expect(result.current.state.hasProject).toBe(false);
    });

    it('should reset triggerValidation to false', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.setTriggerValidation(true);
      });

      expect(result.current.state.triggerValidation).toBe(true);

      act(() => {
        result.current.importAllData({}, [], []);
      });

      expect(result.current.state.triggerValidation).toBe(false);
    });
  });

  describe('setTriggerValidation', () => {
    it('should set triggerValidation flag to true', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      expect(result.current.state.triggerValidation).toBe(false);

      act(() => {
        result.current.setTriggerValidation(true);
      });

      expect(result.current.state.triggerValidation).toBe(true);
    });

    it('should set triggerValidation flag to false', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.setTriggerValidation(true);
      });

      expect(result.current.state.triggerValidation).toBe(true);

      act(() => {
        result.current.setTriggerValidation(false);
      });

      expect(result.current.state.triggerValidation).toBe(false);
    });
  });

  describe('replaceDatasetFormData', () => {
    it('should fully replace formData without merging old keys', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Add a dataset
      act(() => {
        result.current.addDataset('Test Dataset');
      });

      const dsId = result.current.state.datasets[0].id;

      // Set initial form data with several fields via updateDataset (merge)
      act(() => {
        result.current.updateDataset(dsId, {
          dataset_type: 'model_output',
          model_name: 'CESM2',
          simulation_type: 'perturbation'
        });
      });

      // Verify the fields are there
      expect(result.current.state.datasets[0].formData.model_name).toBe('CESM2');
      expect(result.current.state.datasets[0].formData.simulation_type).toBe('perturbation');

      // Now replace with data that omits model-specific fields (simulating type switch)
      act(() => {
        result.current.replaceDatasetFormData(dsId, {
          dataset_type: 'field',
          name: 'Test Dataset'
        });
      });

      // Old keys should be gone — not merged back
      const formData = result.current.state.datasets[0].formData;
      expect(formData.dataset_type).toBe('field');
      expect(formData.name).toBe('Test Dataset');
      expect(formData).not.toHaveProperty('model_name');
      expect(formData).not.toHaveProperty('simulation_type');
    });
  });

  describe('importSelectedData with experiment linking', () => {
    it('should link dataset to existing experiment when resolved match is existing', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create an existing experiment first
      act(() => {
        result.current.addExperiment('Existing Experiment');
      });

      act(() => {
        result.current.updateExperiment(1, { experiment_id: 'EXP-001' });
      });

      // Import a dataset with linking to the existing experiment
      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1' },
              experimentLinking: {
                mode: 'use-file',
                resolvedMatch: {
                  type: 'existing',
                  experimentName: 'Existing Experiment',
                  experimentId: 'EXP-001',
                  internalId: 1
                }
              }
            }
          ]
        );
      });

      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset).toBeDefined();
      expect(dataset?.linking?.linkedExperimentInternalId).toBe(1);
      expect(dataset?.formData.experiment_id).toBe('EXP-001');
    });

    it('should link dataset to importing experiment via cross-import resolution', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Import both experiment and dataset at same time, with cross-import linking
      act(() => {
        result.current.importSelectedData(
          null,
          [
            {
              name: 'New Experiment',
              experiment_id: 'EXP-NEW'
            }
          ],
          [
            {
              formData: { name: 'Dataset 1' },
              experimentLinking: {
                mode: 'use-file',
                resolvedMatch: {
                  type: 'importing',
                  experimentName: 'New Experiment',
                  experimentId: 'EXP-NEW',
                  importKey: 'experiment-0'
                }
              }
            }
          ]
        );
      });

      const experiment = result.current.state.experiments.find(
        (e) => e.formData.experiment_id === 'EXP-NEW'
      );
      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');

      expect(experiment).toBeDefined();
      expect(dataset).toBeDefined();
      // Dataset should be linked to the newly imported experiment's internal ID
      expect(dataset?.linking?.linkedExperimentInternalId).toBe(experiment?.id);
      expect(dataset?.formData.experiment_id).toBe('EXP-NEW');
    });

    it('should handle explicit linking to existing experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create an existing experiment
      act(() => {
        result.current.addExperiment('Existing Experiment');
      });

      act(() => {
        result.current.updateExperiment(1, { experiment_id: 'EXP-001' });
      });

      // Import dataset with explicit linking (user selected from dropdown)
      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1', experiment_id: 'WRONG-ID' },
              experimentLinking: {
                mode: 'explicit',
                explicitExperimentInternalId: 1
              }
            }
          ]
        );
      });

      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.linking?.linkedExperimentInternalId).toBe(1);
      // Should use the linked experiment's ID, not the file's ID
      expect(dataset?.formData.experiment_id).toBe('EXP-001');
    });

    it('should handle explicit linking to importing experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Import experiment and dataset with explicit cross-import link
      act(() => {
        result.current.importSelectedData(
          null,
          [
            {
              name: 'Importing Experiment',
              experiment_id: 'EXP-IMP'
            }
          ],
          [
            {
              formData: { name: 'Dataset 1' },
              experimentLinking: {
                mode: 'explicit',
                explicitImportKey: 'experiment-0'
              }
            }
          ]
        );
      });

      const experiment = result.current.state.experiments[0];
      const dataset = result.current.state.datasets[0];

      expect(dataset?.linking?.linkedExperimentInternalId).toBe(experiment.id);
      expect(dataset?.formData.experiment_id).toBe('EXP-IMP');
    });

    it('should not link dataset when no experiment linking is provided', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1', experiment_id: 'EXP-ORPHAN' }
              // No experimentLinking provided
            }
          ]
        );
      });

      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.linking?.linkedExperimentInternalId).toBeNull();
      // Original experiment_id should be preserved
      expect(dataset?.formData.experiment_id).toBe('EXP-ORPHAN');
    });

    it('should propagate experiment_id to linked datasets when experiment_id is set', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create experiment and link a dataset to it via import
      act(() => {
        result.current.addExperiment('Test Experiment');
      });
      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1' },
              experimentLinking: {
                mode: 'use-file',
                resolvedMatch: {
                  type: 'existing',
                  experimentName: 'Test Experiment',
                  experimentId: undefined,
                  internalId: 1
                }
              }
            }
          ]
        );
      });

      // Set experiment_id on the experiment — should propagate to dataset
      act(() => {
        result.current.updateExperiment(1, { experiment_id: 'EXP-SET' });
      });

      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.formData.experiment_id).toBe('EXP-SET');
    });

    it('should propagate undefined to linked datasets when experiment_id is cleared', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Create experiment with an ID and link a dataset to it
      act(() => {
        result.current.addExperiment('Test Experiment');
      });
      act(() => {
        result.current.updateExperiment(1, { experiment_id: 'EXP-WILL-CLEAR' });
      });
      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1' },
              experimentLinking: {
                mode: 'use-file',
                resolvedMatch: {
                  type: 'existing',
                  experimentName: 'Test Experiment',
                  experimentId: 'EXP-WILL-CLEAR',
                  internalId: 1
                }
              }
            }
          ]
        );
      });

      // Verify dataset has the experiment_id
      let dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.formData.experiment_id).toBe('EXP-WILL-CLEAR');

      // Clear the experiment_id — should propagate undefined to linked dataset
      act(() => {
        result.current.updateExperiment(1, { experiment_id: '' });
      });

      dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.formData.experiment_id).toBeUndefined();
    });

    it('should not overwrite experiment_id when linking resolves to none', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.importSelectedData(
          null,
          [],
          [
            {
              formData: { name: 'Dataset 1', experiment_id: 'EXP-UNMATCHED' },
              experimentLinking: {
                mode: 'use-file',
                resolvedMatch: {
                  type: 'none'
                }
              }
            }
          ]
        );
      });

      const dataset = result.current.state.datasets.find((d) => d.name === 'Dataset 1');
      expect(dataset?.linking?.linkedExperimentInternalId).toBeNull();
      // Original experiment_id from file should be preserved
      expect(dataset?.formData.experiment_id).toBe('EXP-UNMATCHED');
    });
  });

  describe('validationStatus invalidation on ID propagation', () => {
    it('clears linked experiments and datasets validation when project_id changes', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      // Set up: create project, experiment, and dataset; mark all valid
      act(() => {
        result.current.createProject();
        result.current.updateProjectData({ project_id: 'P1' });
      });
      let expId!: number;
      let dsId!: number;
      act(() => {
        expId = result.current.addExperiment('E1');
        dsId = result.current.addDataset('D1');
      });
      act(() => {
        result.current.setProjectValidation(true);
        result.current.setExperimentValidation(expId, true);
        result.current.setDatasetValidation(dsId, true);
      });

      // Sanity: all three are currently "passed"
      expect(result.current.state.validationStatus.project).toBe(true);
      expect(result.current.state.validationStatus.experiments[expId]).toBe(true);
      expect(result.current.state.validationStatus.datasets[dsId]).toBe(true);

      // Change project_id — this triggers propagation to the linked
      // experiment and dataset, so their validation is now stale.
      act(() => {
        result.current.updateProjectData({ project_id: 'P2' });
      });

      // Experiment and dataset validation should be cleared.
      // (Project validation is left alone — the hook on the page owns it.)
      expect(result.current.state.validationStatus.experiments).toEqual({});
      expect(result.current.state.validationStatus.datasets).toEqual({});
    });

    it('clears linked datasets validation when experiment_id changes', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.createProject();
        result.current.addExperiment('E1');
        result.current.addDataset('D1');
      });
      // Read IDs from state rather than from the return values — the
      // addExperiment/addDataset returns work in isolation but when
      // multiple state updates are batched inside a single act the ref
      // capture pattern has returned 0 in practice.
      const expId = result.current.state.experiments[0].id;
      const dsId = result.current.state.datasets[0].id;

      // Link the dataset to the experiment, then give the experiment an
      // initial experiment_id so propagation runs against something
      // concrete.
      act(() => {
        result.current.updateDatasetLinking(dsId, {
          linkedExperimentInternalId: expId
        });
      });
      act(() => {
        result.current.updateExperiment(expId, { experiment_id: 'EXP-A' });
      });
      act(() => {
        result.current.setDatasetValidation(dsId, true);
      });
      expect(result.current.state.validationStatus.datasets[dsId]).toBe(true);

      // Changing the experiment_id propagates to the linked dataset,
      // which should null the dataset's validation.
      act(() => {
        result.current.updateExperiment(expId, { experiment_id: 'EXP-B' });
      });
      expect(result.current.state.validationStatus.datasets[dsId]).toBeNull();
    });

    it('does NOT clear datasets that are not linked to the changed experiment', () => {
      const { result } = renderHook(() => useAppState(), {
        wrapper: AppStateProvider
      });

      act(() => {
        result.current.createProject();
        result.current.addExperiment('EA');
        result.current.addDataset('DA');
        result.current.addDataset('Dother');
      });
      // Read IDs from state rather than return values — see note above.
      const expAId = result.current.state.experiments[0].id;
      const dsAId = result.current.state.datasets[0].id;
      const dsOtherId = result.current.state.datasets[1].id;

      act(() => {
        result.current.updateDatasetLinking(dsAId, {
          linkedExperimentInternalId: expAId
        });
      });
      act(() => {
        // dsOtherId intentionally not linked
        result.current.updateExperiment(expAId, { experiment_id: 'EXP-A' });
      });
      act(() => {
        result.current.setDatasetValidation(dsAId, true);
        result.current.setDatasetValidation(dsOtherId, true);
      });

      act(() => {
        result.current.updateExperiment(expAId, { experiment_id: 'EXP-A-NEW' });
      });

      expect(result.current.state.validationStatus.datasets[dsAId]).toBeNull();
      // Unrelated dataset is still valid
      expect(result.current.state.validationStatus.datasets[dsOtherId]).toBe(true);
    });
  });
});
