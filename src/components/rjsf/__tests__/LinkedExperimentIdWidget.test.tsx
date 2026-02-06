import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import LinkedExperimentIdWidget from '../LinkedExperimentIdWidget';
import { AppStateProvider, useAppState } from '@/contexts/AppStateContext';
import { MantineProvider } from '@mantine/core';

// JSDOM doesn't support scrollIntoView - mock it to prevent Mantine combobox errors
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

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

// Default widget props
const defaultProps = {
  id: 'test-experiment-id',
  name: 'experiment_id',
  label: 'Experiment',
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
  // Visibility
  // ============================================================

  describe('Visibility', () => {
    it('renders nothing when no experiments exist', () => {
      const { container } = render(
        <TestWrapper setup={(api) => {
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      // Widget should not render anything
      expect(container.querySelector('input')).not.toBeInTheDocument();
    });

    it('renders dropdown when experiments exist', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Select experiment')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Dropdown options
  // ============================================================

  describe('Dropdown options', () => {
    it('shows all experiments by name with "None" option at end', async () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Baseline Study');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addExperiment('Treatment Run');
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      // Experiments shown by name only (no experiment_id in label)
      expect(await screen.findByText('Baseline Study')).toBeInTheDocument();
      expect(screen.getByText('Treatment Run')).toBeInTheDocument();
      // "None" option at end
      expect(screen.getByText('None')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Selection behavior
  // ============================================================

  describe('Selection', () => {
    it('sets experiment_id when selecting experiment that has one', async () => {
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

      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      const option = await screen.findByText('Experiment 1');
      await user.click(option);

      expect(onChange).toHaveBeenCalledWith('EXP-001');
    });

    it('sets undefined when selecting experiment without experiment_id', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Treatment Run');
          api.addDataset('Test Dataset');
        }}>
          <LinkedExperimentIdWidget {...defaultProps} onChange={onChange} />
        </TestWrapper>
      );

      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      const option = await screen.findByText('Treatment Run');
      await user.click(option);

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('clears experiment linking when "None" selected', async () => {
      const onChange = vi.fn();

      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Experiment 1');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, {
            linkedExperimentInternalId: 1
          });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="EXP-001" onChange={onChange} />
        </TestWrapper>
      );

      const select = screen.getByPlaceholderText('Select experiment');
      await user.click(select);

      const noneOption = await screen.findByText('None');
      await user.click(noneOption);

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  // ============================================================
  // Error when linked experiment has no ID
  // ============================================================

  describe('Missing experiment_id warning', () => {
    it('shows error when linked experiment has no experiment_id', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Treatment Run');
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, {
            linkedExperimentInternalId: 1
          });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(
        'Linked experiment "Treatment Run" has no Experiment ID. Please set one on the Experiment page.'
      )).toBeInTheDocument();
    });

    it('does not show error when linked experiment has experiment_id', () => {
      render(
        <TestWrapper setup={(api) => {
          api.addExperiment('Baseline Study');
          api.updateExperiment(1, { experiment_id: 'EXP-001' });
          api.addDataset('Test Dataset');
          api.updateDatasetLinking(1, {
            linkedExperimentInternalId: 1
          });
        }}>
          <LinkedExperimentIdWidget {...defaultProps} value="EXP-001" />
        </TestWrapper>
      );

      expect(screen.queryByText(/has no Experiment ID/)).not.toBeInTheDocument();
    });
  });
});
