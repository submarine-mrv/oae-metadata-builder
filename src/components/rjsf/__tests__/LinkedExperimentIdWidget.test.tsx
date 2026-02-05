import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import LinkedExperimentIdWidget from '../LinkedExperimentIdWidget';
import { AppStateProvider, useAppState } from '@/contexts/AppStateContext';
import { MantineProvider } from '@mantine/core';

// Helper to setup state before rendering widget
function StateSetup({
  setup
}: {
  setup: (api: ReturnType<typeof useAppState>) => void
}) {
  const api = useAppState();
  React.useEffect(() => {
    setup(api);
  }, []);
  return null;
}

// Wrapper component with providers
function TestWrapper({
  children,
  setup
}: {
  children: React.ReactNode;
  setup?: (api: ReturnType<typeof useAppState>) => void;
}) {
  return (
    <MantineProvider>
      <AppStateProvider>
        {setup && <StateSetup setup={setup} />}
        {children}
      </AppStateProvider>
    </MantineProvider>
  );
}

// Wrapper that delays rendering child until state is ready
// This simulates real navigation behavior where state exists before component mounts
function DelayedRenderWrapper({
  children,
  setup
}: {
  children: React.ReactNode;
  setup?: (api: ReturnType<typeof useAppState>) => void;
}) {
  const [ready, setReady] = useState(false);
  const api = useAppState();

  React.useEffect(() => {
    if (setup) {
      setup(api);
    }
    // Small delay to ensure state has propagated
    setTimeout(() => setReady(true), 0);
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

function TestWrapperDelayed({
  children,
  setup
}: {
  children: React.ReactNode;
  setup?: (api: ReturnType<typeof useAppState>) => void;
}) {
  return (
    <MantineProvider>
      <AppStateProvider>
        <DelayedRenderWrapper setup={setup}>
          {children}
        </DelayedRenderWrapper>
      </AppStateProvider>
    </MantineProvider>
  );
}

// Default widget props
const defaultProps = {
  id: 'test-experiment-id',
  name: 'experiment_id',
  label: 'Experiment ID',
  value: undefined as string | undefined,
  required: false,
  disabled: false,
  readonly: false,
  hideLabel: false,
  autofocus: false,
  onChange: vi.fn(),
  onBlur: vi.fn(),
  onFocus: vi.fn(),
  schema: {},
  uiSchema: {},
  rawErrors: [],
  formContext: {},
  registry: {} as any,
  options: {},
};

describe('LinkedExperimentIdWidget', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  // ============================================================
  // Initial State Tests
  // ============================================================

  describe('Initial rendering', () => {
    it('shows disabled dropdown when no experiments exist', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      // Should show Select (dropdown mode) with autopopulate placeholder
      const select = screen.getByPlaceholderText('Experiment ID options will be autopopulated when available');
      expect(select).toBeInTheDocument();

      // Select should be disabled (cannot interact)
      expect(select).toBeDisabled();

      // IconLink button (unlink) should be enabled
      const unlinkButton = screen.getByRole('button', { name: /switch to manual entry/i });
      expect(unlinkButton).toBeEnabled();
    });

    it('shows dropdown when experiments with IDs exist', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      // Should show Select (dropdown mode)
      expect(screen.getByPlaceholderText('Select experiment')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 1: dropdown + select experiment → dropdown
  // ============================================================

  describe('Transition 1: dropdown + select experiment → dropdown', () => {
    it('stays in dropdown and sets value when experiment selected', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      // Open dropdown and select experiment
      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      const option = await screen.findByText('Experiment 1 (EXP-001)');
      await user.click(option);

      // Should call onChange with experiment_id
      expect(onChange).toHaveBeenCalledWith('EXP-001');

      // Should still be in dropdown mode (select still visible)
      expect(screen.getByPlaceholderText('Select experiment')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 2: dropdown + "Custom (manual entry)" → freetext
  // ============================================================

  describe('Transition 2: dropdown + "Custom (manual entry)" → freetext', () => {
    it('switches to freetext when "Custom" selected', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      // Open dropdown and select "Custom (manual entry)"
      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      const customOption = await screen.findByText('Custom (manual entry)');
      await user.click(customOption);

      // Should call onChange with undefined (clear value)
      expect(onChange).toHaveBeenCalledWith(undefined);

      // Should switch to freetext mode (TextInput visible)
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 3: dropdown + unlink button → freetext
  // ============================================================

  describe('Transition 3: dropdown + unlink button → freetext', () => {
    it('switches to freetext with empty value when unlink clicked', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          // Link to experiment first
          api.updateDatasetLinking(1, {
            linkedExperimentInternalId: 1,
            usesCustomExperimentId: false
          });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="EXP-001" onChange={onChange} />
        </TestWrapper>
      );

      // Click unlink button (has aria-label "Switch to manual entry")
      const unlinkButton = screen.getByRole('button', { name: /switch to manual entry/i });
      await user.click(unlinkButton);

      // Should call onChange with undefined (NOT prefill with EXP-001)
      expect(onChange).toHaveBeenCalledWith(undefined);

      // Should switch to freetext mode
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 4: freetext + link button → dropdown
  // ============================================================

  describe('Transition 4: freetext + link button → dropdown', () => {
    it('switches to dropdown when link button clicked', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          // Set to custom mode
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="custom-value" onChange={onChange} />
        </TestWrapper>
      );

      // Should be in freetext mode initially
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();

      // Click link button
      const linkButton = screen.getByRole('button', { name: /switch to experiment selection/i });
      await user.click(linkButton);

      // Should call onChange with undefined
      expect(onChange).toHaveBeenCalledWith(undefined);

      // Should switch to dropdown mode
      expect(screen.getByPlaceholderText('Select experiment')).toBeInTheDocument();
    });

    it('switches to disabled dropdown when link button clicked and no experiments exist', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addDataset('Test Dataset');
          // Set to custom mode but no experiments with IDs
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      // Should be in freetext mode initially
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();

      // Link button should be enabled
      const linkButton = screen.getByRole('button', { name: /switch to experiment selection/i });
      expect(linkButton).toBeEnabled();

      // Click link button
      await user.click(linkButton);

      // Should call onChange with undefined
      expect(onChange).toHaveBeenCalledWith(undefined);

      // Should switch to disabled dropdown with autopopulate message
      const select = screen.getByPlaceholderText('Experiment ID options will be autopopulated when available');
      expect(select).toBeInTheDocument();
      expect(select).toBeDisabled();
    });
  });

  // ============================================================
  // Transition 5: freetext + type in textbox → freetext
  // ============================================================

  describe('Transition 5: freetext + type in textbox → freetext', () => {
    it('updates value while staying in freetext mode', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Enter experiment ID');
      await user.type(input, 'MY-CUSTOM-ID');

      // Should call onChange for each character
      expect(onChange).toHaveBeenCalled();

      // Should still be in freetext mode
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 6: freetext + clear textbox → freetext (same session)
  // ============================================================

  describe('Transition 6: freetext + clear textbox → freetext', () => {
    it('stays in freetext mode when value cleared (same session)', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="some-value" onChange={onChange} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Enter experiment ID');

      // Clear the input
      await user.clear(input);

      // Should call onChange with undefined (empty string converts to undefined)
      expect(onChange).toHaveBeenCalledWith(undefined);

      // Should still be in freetext mode (not switch back to dropdown during same session)
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Transition 7: initial mount with empty value → dropdown (lazy reset)
  // ============================================================

  describe('Transition 7: initial mount with empty value → dropdown', () => {
    it('resets usesCustomExperimentId on mount when value empty', async () => {
      // This test verifies the lazy reset behavior
      // When usesCustomExperimentId is true but value is empty on mount,
      // it should reset to dropdown mode
      //
      // We use TestWrapperDelayed to ensure state is set up BEFORE the widget mounts,
      // simulating real navigation behavior where the dataset already exists.

      render(
        <TestWrapperDelayed setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          // Set custom mode flag, but value will be undefined
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value={undefined} />
        </TestWrapperDelayed>
      );

      // After mount with empty value, should have reset to dropdown mode
      // The useEffect triggers a state update, so we need to wait for re-render
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Select experiment')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // Transition 8: initial mount with experiments but none have IDs → disabled dropdown
  // ============================================================

  describe('Transition 8: initial mount with experiments but none have IDs', () => {
    it('shows disabled dropdown when experiments exist but none have IDs', () => {
      render(
        <TestWrapper setup={(api) => {
          // Add experiments but none with IDs
          api.addExperiment('Experiment 1');
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      // Should show disabled dropdown with autopopulate placeholder
      const select = screen.getByPlaceholderText('Experiment ID options will be autopopulated when available');
      expect(select).toBeInTheDocument();
      expect(select).toBeDisabled();

      // IconLink button (unlink) should be enabled
      const unlinkButton = screen.getByRole('button', { name: /switch to manual entry/i });
      expect(unlinkButton).toBeEnabled();
    });
  });

  // ============================================================
  // Edge case: preserve freetext on mount with existing value
  // ============================================================

  describe('Preserve freetext on mount with value', () => {
    it('preserves usesCustomExperimentId on mount when value is set', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="custom-exp-id" />
        </TestWrapper>
      );

      // Should stay in freetext mode because value is set
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
      // The value should be displayed
      expect(screen.getByDisplayValue('custom-exp-id')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Edge case: user explicitly switches to freetext, stays there when experiments appear
  // ============================================================

  describe('Freetext mode lock when user explicitly switched', () => {
    it('stays in freetext mode after experiments with IDs are created if user explicitly switched to freetext', async () => {
      // SCENARIO: User creates dataset before any experiments exist.
      // They click unlink to manually enter an experiment ID.
      // Later, experiments with IDs are created (maybe by another user or on another tab).
      // The widget should NOT suddenly switch to dropdown - user's explicit choice is honored.

      const onChange = vi.fn();

      // Component that allows us to add experiments after initial render
      function TestScenario() {
        const api = useAppState();
        const [experimentCreated, setExperimentCreated] = React.useState(false);

        React.useEffect(() => {
          // Initial setup: dataset exists, no experiments with IDs
          // User has explicitly switched to freetext mode
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, { usesCustomExperimentId: true });
        }, []);

        const createExperimentWithId = () => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          setExperimentCreated(true);
        };

        return (
          <>
            <LinkedExperimentIdWidget {...defaultProps} value="my-custom-exp" onChange={onChange} />
            <button data-testid="create-experiment" onClick={createExperimentWithId}>
              Create Experiment
            </button>
            {experimentCreated && <span data-testid="experiment-created">Created</span>}
          </>
        );
      }

      render(
        <MantineProvider>
          <AppStateProvider>
            <TestScenario />
          </AppStateProvider>
        </MantineProvider>
      );

      // Wait for initial render - should be in freetext mode (user explicitly switched)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
      });

      // Verify the custom value is displayed
      expect(screen.getByDisplayValue('my-custom-exp')).toBeInTheDocument();

      // Now create an experiment with an ID (simulates user going to experiment tab and creating one)
      await user.click(screen.getByTestId('create-experiment'));

      // Wait for the experiment to be created
      await waitFor(() => {
        expect(screen.getByTestId('experiment-created')).toBeInTheDocument();
      });

      // The widget should STILL be in freetext mode, NOT switch to dropdown
      // User's explicit choice to use freetext is honored
      expect(screen.getByPlaceholderText('Enter experiment ID')).toBeInTheDocument();
      expect(screen.getByDisplayValue('my-custom-exp')).toBeInTheDocument();
    });
  });
});
