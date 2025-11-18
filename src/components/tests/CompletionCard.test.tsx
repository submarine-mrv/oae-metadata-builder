import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CompletionCard } from '../CompletionCard';

describe('CompletionCard', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with required props', () => {
    render(<CompletionCard title="Test Card" progress={50} onEdit={mockOnEdit} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <CompletionCard title="Test Card" subtitle="Test subtitle" progress={50} onEdit={mockOnEdit} />
    );
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <CompletionCard
        title="Test Card"
        progress={50}
        onEdit={mockOnEdit}
        badge={<div>Test Badge</div>}
      />
    );
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('shows delete button when showDeleteButton is true', () => {
    render(
      <CompletionCard
        title="Test Card"
        progress={50}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        showDeleteButton={true}
      />
    );
    const deleteButton = screen.getByRole('button');
    expect(deleteButton).toBeInTheDocument();
  });

  it('calls onEdit when card is clicked', () => {
    render(<CompletionCard title="Test Card" progress={50} onEdit={mockOnEdit} />);
    const card = screen.getByText('Test Card').closest('.mantine-Card-root');
    if (card) {
      fireEvent.click(card);
    }
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(
      <CompletionCard
        title="Test Card"
        progress={50}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        showDeleteButton={true}
      />
    );
    const deleteButton = screen.getByRole('button');
    fireEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockOnEdit).not.toHaveBeenCalled(); // Should not trigger onEdit
  });

  it('displays correct completion label for different progress values', () => {
    const { rerender } = render(<CompletionCard title="Test" progress={0} onEdit={mockOnEdit} />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();

    rerender(<CompletionCard title="Test" progress={25} onEdit={mockOnEdit} />);
    expect(screen.getByText('Just Started')).toBeInTheDocument();

    rerender(<CompletionCard title="Test" progress={50} onEdit={mockOnEdit} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    rerender(<CompletionCard title="Test" progress={80} onEdit={mockOnEdit} />);
    expect(screen.getByText('Almost Done')).toBeInTheDocument();

    rerender(<CompletionCard title="Test" progress={100} onEdit={mockOnEdit} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('formats lastUpdated timestamp when provided', () => {
    const timestamp = new Date('2024-01-01T12:00:00').getTime();
    render(
      <CompletionCard title="Test Card" progress={50} onEdit={mockOnEdit} lastUpdated={timestamp} />
    );
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });
});
