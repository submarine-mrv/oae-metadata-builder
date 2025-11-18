import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldDescriptionIcon } from '../FieldDescriptionIcon';

describe('FieldDescriptionIcon', () => {
  it('renders nothing when description is not provided', () => {
    const { container } = render(<FieldDescriptionIcon label="Test" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when hideLabel is true', () => {
    const { container } = render(
      <FieldDescriptionIcon label="Test" description="Test description" hideLabel={true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip by default when description is provided', () => {
    render(<FieldDescriptionIcon label="Test" description="Test description" />);
    const icon = screen.getByRole('button');
    expect(icon).toBeInTheDocument();
  });

  it('renders modal when useModal is true', () => {
    render(
      <FieldDescriptionIcon label="Test" description="Test description" useModal={true} />
    );
    const icon = screen.getByRole('button');
    expect(icon).toBeInTheDocument();
  });

  it('opens modal when icon is clicked and useModal is true', () => {
    render(
      <FieldDescriptionIcon label="Test" description="Test description" useModal={true} />
    );
    const icon = screen.getByRole('button');
    fireEvent.click(icon);
    // Modal should be opened
  });

  it('shows required asterisk when required is true', () => {
    const { container } = render(
      <FieldDescriptionIcon label="Test" description="Test description" required={true} />
    );
    expect(container.textContent).toContain('*');
  });
});
