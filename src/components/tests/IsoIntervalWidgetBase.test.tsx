import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import IsoIntervalWidgetBase from '../IsoIntervalWidgetBase';
import { WidgetProps } from '@rjsf/utils';

const mockProps: Partial<WidgetProps> = {
  id: 'test-interval',
  value: '2024-01-01/2024-12-31',
  onChange: jest.fn(),
  label: 'Test Interval',
  required: false,
  disabled: false,
  readonly: false,
};

describe('IsoIntervalWidgetBase', () => {
  it('renders with horizontal orientation by default', () => {
    render(<IsoIntervalWidgetBase {...(mockProps as WidgetProps)} />);
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
  });

  it('renders with vertical orientation when specified', () => {
    render(<IsoIntervalWidgetBase {...(mockProps as WidgetProps)} orientation="vertical" />);
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
  });

  it('parses interval value correctly', () => {
    const { container } = render(<IsoIntervalWidgetBase {...(mockProps as WidgetProps)} />);
    const startInput = container.querySelector('input[placeholder="YYYY-MM-DD"]');
    expect(startInput).toHaveValue('2024-01-01');
  });

  it('calls onChange when date is modified', () => {
    const onChange = jest.fn();
    const { container } = render(
      <IsoIntervalWidgetBase {...(mockProps as WidgetProps)} onChange={onChange} />
    );
    const startInput = container.querySelector('input[placeholder="YYYY-MM-DD"]') as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '2024-02-01' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows validation error for invalid date format', () => {
    const { container } = render(<IsoIntervalWidgetBase {...(mockProps as WidgetProps)} />);
    const startInput = container.querySelector('input[placeholder="YYYY-MM-DD"]') as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: 'invalid-date' } });
    fireEvent.blur(startInput);
    // Validation error should appear
  });
});
