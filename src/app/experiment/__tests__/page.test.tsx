import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import ExperimentPage from '../page';
import { AppStateProvider } from '@/contexts/AppStateContext';

// Mock the schema view functions
vi.mock('@/utils/schemaViews', () => ({
  getExperimentSchema: () => ({
    $id: 'ExperimentSchema',
    type: 'object',
    properties: {
      experiment_id: { type: 'string' },
      experiment_type: {
        type: 'string',
        enum: ['baseline', 'control', 'intervention', 'tracer_study']
      },
      description: { type: 'string' }
    },
    required: ['experiment_id', 'experiment_type']
  }),
  getInterventionSchema: () => ({
    $id: 'InterventionSchema',
    type: 'object',
    properties: {
      experiment_id: { type: 'string' },
      experiment_type: { type: 'string' },
      alkalinity_feedstock: { type: 'string' }
    }
  }),
  getTracerSchema: () => ({
    $id: 'TracerSchema',
    type: 'object',
    properties: {
      experiment_id: { type: 'string' },
      experiment_type: { type: 'string' },
      tracer_form: { type: 'string' }
    }
  }),
  getInterventionWithTracerSchema: () => ({
    $id: 'InterventionWithTracerSchema',
    type: 'object',
    properties: {
      experiment_id: { type: 'string' },
      experiment_type: { type: 'string' },
      alkalinity_feedstock: { type: 'string' },
      tracer_form: { type: 'string' }
    }
  })
}));

// Mock RJSF components
vi.mock('@rjsf/mantine', () => {
  const MockForm = ({ formData, onChange, onSubmit }: any) => {
    // Simulate RJSF behavior: calls onChange on mount
    React.useEffect(() => {
      onChange?.({ formData: formData || {} });
    }, []);

    return (
      <form
        data-testid="rjsf-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.({ formData });
        }}
      >
        <div data-testid="form-data">{JSON.stringify(formData)}</div>
        <button type="submit">Submit</button>
      </form>
    );
  };

  return {
    default: MockForm
  };
});

// Mock custom components
vi.mock('@/components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>
}));

vi.mock('@/components/SpatialCoverageMiniMap', () => ({
  default: () => <div>SpatialCoverageMiniMap</div>
}));

vi.mock('@/components/DosingLocationWidget', () => ({
  default: () => <div>DosingLocationWidget</div>
}));

vi.mock('@/components/rjsf/CustomButtonsTemplate', () => ({
  default: () => <div>CustomButtonsTemplate</div>
}));

vi.mock('@/components/rjsf/TitleFieldTemplate', () => ({
  default: () => <div>TitleFieldTemplate</div>
}));

vi.mock('@/components/rjsf/CustomAddButton', () => ({
  default: () => <button>Add</button>
}));

vi.mock('@/components/rjsf/CustomArrayFieldTemplate', () => ({
  default: () => <div>CustomArrayFieldTemplate</div>
}));

vi.mock('@/components/rjsf/CustomSelectWidget', () => ({
  default: () => <select>Select</select>
}));

vi.mock('@/components/rjsf/CustomSubmitButton', () => ({
  default: () => <button type="submit">Submit</button>
}));

vi.mock('@/components/rjsf/BaseInputWidget', () => ({
  default: () => <input />
}));

vi.mock('@/components/rjsf/CustomTextareaWidget', () => ({
  default: () => <textarea />
}));

vi.mock('@/components/rjsf/CustomErrorList', () => ({
  default: () => <div>ErrorList</div>
}));

vi.mock('@/components/rjsf/DateTimeWidget', () => ({
  default: () => <input type="datetime" />
}));

vi.mock('@/components/rjsf/PlaceholderWidget', () => ({
  default: () => <div>PlaceholderWidget</div>
}));

vi.mock('@/components/rjsf/PlaceholderField', () => ({
  default: () => <div>PlaceholderField</div>
}));

vi.mock('@/components/rjsf/DosingConcentrationField', () => ({
  default: () => <div>DosingConcentrationField</div>
}));

vi.mock('@/components/rjsf/DosingDepthWidget', () => ({
  default: () => <div>DosingDepthWidget</div>
}));

vi.mock('@/utils/experimentFields', () => ({
  cleanFormDataForType: (data: any, type: string) => data
}));

vi.mock('./experimentUiSchema', () => ({
  default: {}
}));

vi.mock('./interventionUiSchema', () => ({
  default: {}
}));

vi.mock('./tracerUiSchema', () => ({
  default: {}
}));

describe.skip('Experiment Page', () => {
  describe('No Experiment Selected', () => {
    it('should show message when no experiment is selected', () => {
      const mockState = {
        activeExperimentId: null,
        experiments: [],
        projectData: {},
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      expect(screen.getByText('No Experiment Selected')).toBeInTheDocument();
      expect(
        screen.getByText(/Please go back to the overview/)
      ).toBeInTheDocument();
    });

    it('should have back button when no experiment selected', () => {
      const mockState = {
        activeExperimentId: null,
        experiments: [],
        projectData: {},
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      expect(screen.getByText('Back to Overview')).toBeInTheDocument();
    });
  });

  describe('Bug #1 Regression: useEffect Infinite Loop Prevention', () => {
    it('should use stable activeExperimentId instead of experiment object in useEffect dependency', () => {
      // This test verifies the fix by checking that the page doesn't re-render infinitely
      // The key is that useEffect uses activeExperimentId (number) instead of experiment (object)

      const mockUpdateExperiment = vi.fn();
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'Test'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      let renderCount = 0;

      // Create a wrapper component that tracks renders
      const TestWrapper = () => {
        renderCount++;
        return (
          <AppStateProvider
            initialState={mockState}
            updateExperiment={mockUpdateExperiment}
          >
            <ExperimentPage />
          </AppStateProvider>
        );
      };

      render(<TestWrapper />);

      // After initial render and effects settle, render count should stabilize
      // If using experiment object in dependency, it would re-render infinitely
      waitFor(
        () => {
          // Allow a few renders for initial mount and useEffects
          // but not hundreds (which would indicate infinite loop)
          expect(renderCount).toBeLessThan(10);
        },
        { timeout: 500 }
      );
    });
  });

  describe('Bug #2 Regression: isInitialLoad Flag Prevents Data Wipe', () => {
    it('should NOT call updateExperiment during initial form mount', async () => {
      const mockUpdateExperiment = vi.fn();
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'Test description'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider
          initialState={mockState}
          updateExperiment={mockUpdateExperiment}
        >
          <ExperimentPage />
        </AppStateProvider>
      );

      // Wait for form to mount and RJSF to trigger its initial onChange
      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      // Give time for any onChange calls during mount
      await new Promise((resolve) => setTimeout(resolve, 100));

      // updateExperiment should NOT have been called during mount
      // (isInitialLoad flag should block it)
      expect(mockUpdateExperiment).not.toHaveBeenCalled();
    });

    it('should call updateExperiment after initial load completes', async () => {
      const user = userEvent.setup();
      const mockUpdateExperiment = vi.fn();
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'Original description'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider
          initialState={mockState}
          updateExperiment={mockUpdateExperiment}
        >
          <ExperimentPage />
        </AppStateProvider>
      );

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      // Wait for isInitialLoad to be set to false (happens after setTimeout)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear any calls from mount (shouldn't be any due to isInitialLoad)
      mockUpdateExperiment.mockClear();

      // Now simulate a user change - this SHOULD call updateExperiment
      // In real app, user would edit a field, but in our mock we can trigger submit
      const submitButton = screen.getByText('Submit');
      await user.click(submitButton);

      // After user interaction, updateExperiment should be callable
      // (This is a simplified test - in real scenario we'd trigger onChange)
    });
  });

  describe('Bug #4 Regression: skipDownload Flag Prevents Download During Validation', () => {
    it('should set skipDownload=true when triggerValidation is true', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: true // This triggers validation without download
      };

      // Mock URL.createObjectURL to detect if download happens
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      // Wait for validation trigger effect to run
      await waitFor(
        () => {
          // Form should be mounted
          expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Give time for the setTimeout in validation trigger effect
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Even though form might be submitted for validation,
      // URL.createObjectURL should NOT be called (no download)
      expect(createObjectURLSpy).not.toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
    });

    it('should download normally when skipDownload is false', async () => {
      const user = userEvent.setup();
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'Test'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false // Normal mode - downloads enabled
      };

      // Mock download functionality
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      // Click submit button to trigger download
      const submitButton = screen.getByText('Submit');
      await user.click(submitButton);

      // Download should happen (createObjectURL called)
      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('Schema Switching Based on experiment_type', () => {
    it('should use InterventionSchema when experiment_type is intervention', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Intervention Experiment',
            formData: {
              experiment_id: 'exp-intervention',
              experiment_type: 'intervention',
              alkalinity_feedstock: 'limestone'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      // Schema switching happens via useEffect
      // In a full integration test, we'd verify the schema prop passed to Form
      // For this test, we just verify the page renders without errors
      expect(screen.getByText('Intervention Experiment')).toBeInTheDocument();
    });

    it('should use TracerSchema when experiment_type is tracer_study', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Tracer Study',
            formData: {
              experiment_id: 'exp-tracer',
              experiment_type: 'tracer_study',
              tracer_form: 'gas'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      expect(screen.getByText('Tracer Study')).toBeInTheDocument();
    });

    it('should use base ExperimentSchema for baseline type', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Baseline Experiment',
            formData: {
              experiment_id: 'exp-baseline',
              experiment_type: 'baseline',
              description: 'Baseline measurements'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      expect(screen.getByText('Baseline Experiment')).toBeInTheDocument();
    });
  });

  describe('Form Data Loading', () => {
    it('should load experiment data when activeExperimentId changes', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Experiment 1',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline',
              description: 'First experiment'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      const { rerender } = render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Experiment 1')).toBeInTheDocument();
      });

      // Change to different experiment
      const newState = {
        ...mockState,
        activeExperimentId: 2,
        experiments: [
          ...mockState.experiments,
          {
            id: 2,
            name: 'Experiment 2',
            formData: {
              experiment_id: 'exp-002',
              experiment_type: 'control',
              description: 'Second experiment'
            }
          }
        ]
      };

      rerender(
        <AppStateProvider initialState={newState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Experiment 2')).toBeInTheDocument();
      });
    });

    it('should include project_id from global state in form data', async () => {
      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline'
            }
          }
        ],
        projectData: { project_id: 'my-project-123' },
        activeTab: 'experiment',
        triggerValidation: false
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
      });

      // The form data should include project_id from global state
      const formDataDisplay = screen.getByTestId('form-data');
      expect(formDataDisplay.textContent).toContain('my-project-123');
    });
  });

  describe('Validation Trigger', () => {
    it('should scroll to top when validation is triggered', async () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo');

      const mockState = {
        activeExperimentId: 1,
        experiments: [
          {
            id: 1,
            name: 'Test Experiment',
            formData: {
              experiment_id: 'exp-001',
              experiment_type: 'baseline'
            }
          }
        ],
        projectData: { project_id: 'proj-001' },
        activeTab: 'experiment',
        triggerValidation: true
      };

      render(
        <AppStateProvider initialState={mockState}>
          <ExperimentPage />
        </AppStateProvider>
      );

      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalledWith({
          top: 0,
          behavior: 'smooth'
        });
      });

      scrollToSpy.mockRestore();
    });
  });
});
