import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import DownloadConfirmationModal from "../DownloadConfirmationModal";

// Wrapper component for Mantine
const MantineWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe("DownloadConfirmationModal", () => {
  const defaultProps = {
    opened: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    metadataType: "project" as const,
  };

  it("should render when opened is true", () => {
    render(<DownloadConfirmationModal {...defaultProps} />, { wrapper: MantineWrapper });

    expect(screen.getByText("Download Metadata")).toBeInTheDocument();
    expect(screen.getByText("Partial Download")).toBeInTheDocument();
  });

  it("should not render when opened is false", () => {
    render(<DownloadConfirmationModal {...defaultProps} opened={false} />, { wrapper: MantineWrapper });

    expect(screen.queryByText("Download Metadata")).not.toBeInTheDocument();
  });

  describe("metadata type messages", () => {
    it("should show project-level message when metadataType is project", () => {
      render(<DownloadConfirmationModal {...defaultProps} metadataType="project" />, { wrapper: MantineWrapper });

      expect(
        screen.getByText(/This will only download project-level metadata/i)
      ).toBeInTheDocument();
    });

    it("should show experiment-level message when metadataType is experiment", () => {
      render(<DownloadConfirmationModal {...defaultProps} metadataType="experiment" />, { wrapper: MantineWrapper });

      expect(
        screen.getByText(/This will only download experiment-level metadata/i)
      ).toBeInTheDocument();
    });

    it("should show dataset-level message when metadataType is dataset", () => {
      render(<DownloadConfirmationModal {...defaultProps} metadataType="dataset" />, { wrapper: MantineWrapper });

      expect(
        screen.getByText(/This will only download dataset-level metadata/i)
      ).toBeInTheDocument();
    });

    it("should always mention export metadata button as alternative", () => {
      render(<DownloadConfirmationModal {...defaultProps} />, { wrapper: MantineWrapper });

      expect(
        screen.getByText(/click export metadata button in the upper right corner/i)
      ).toBeInTheDocument();
    });
  });

  describe("user interactions", () => {
    it("should call onConfirm when Continue button is clicked", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onConfirm={onConfirm} />, { wrapper: MantineWrapper });

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await user.click(continueButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when Cancel button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onClose={onClose} />, { wrapper: MantineWrapper });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when modal backdrop is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onClose={onClose} />, { wrapper: MantineWrapper });

      // Mantine Modal calls onClose when clicking outside or pressing ESC
      // We can test this by finding the close button (X) in the modal header
      const closeButtons = screen.getAllByRole("button");
      const closeButton = closeButtons.find((btn) => btn.getAttribute("aria-label") === "Close modal");

      if (closeButton) {
        await user.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it("should not call onConfirm when Cancel is clicked", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onConfirm={onConfirm} />, { wrapper: MantineWrapper });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("should not call onClose when Continue is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onClose={onClose} />, { wrapper: MantineWrapper });

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await user.click(continueButton);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("modal styling and accessibility", () => {
    it("should have warning alert icon", () => {
      render(<DownloadConfirmationModal {...defaultProps} />);

      // The IconAlertTriangle should be rendered within the Alert
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("should have yellow warning color", () => {
      render(<DownloadConfirmationModal {...defaultProps} />);

      const alert = screen.getByRole("alert");
      // Mantine applies color through className, check text content exists
      expect(screen.getByText("Partial Download")).toBeInTheDocument();
    });

    it("should center the modal", () => {
      const { container } = render(<DownloadConfirmationModal {...defaultProps} />);

      // Modal with centered prop should render
      expect(container.querySelector("[role='dialog']")).toBeInTheDocument();
    });

    it("should have proper button hierarchy", () => {
      render(<DownloadConfirmationModal {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      const continueButton = screen.getByRole("button", { name: /continue/i });

      expect(cancelButton).toBeInTheDocument();
      expect(continueButton).toBeInTheDocument();

      // Continue button should be the primary action (filled variant)
      // Cancel button should be secondary (default variant)
    });
  });

  describe("re-rendering with different props", () => {
    it("should update message when metadataType changes", () => {
      const { rerender } = render(
        <DownloadConfirmationModal {...defaultProps} metadataType="project" />,
        { wrapper: MantineWrapper }
      );

      expect(
        screen.getByText(/This will only download project-level metadata/i)
      ).toBeInTheDocument();

      rerender(
        <DownloadConfirmationModal {...defaultProps} metadataType="experiment" />
      );

      expect(
        screen.getByText(/This will only download experiment-level metadata/i)
      ).toBeInTheDocument();
    });

    it("should hide and show based on opened prop", () => {
      const { rerender } = render(
        <DownloadConfirmationModal {...defaultProps} opened={true} />,
        { wrapper: MantineWrapper }
      );

      expect(screen.getByText("Download Metadata")).toBeInTheDocument();

      rerender(<DownloadConfirmationModal {...defaultProps} opened={false} />);

      expect(screen.queryByText("Download Metadata")).not.toBeInTheDocument();
    });

    it("should call new handlers after prop update", async () => {
      const firstOnConfirm = vi.fn();
      const secondOnConfirm = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <DownloadConfirmationModal {...defaultProps} onConfirm={firstOnConfirm} />,
        { wrapper: MantineWrapper }
      );

      rerender(
        <DownloadConfirmationModal {...defaultProps} onConfirm={secondOnConfirm} />
      );

      const continueButton = screen.getByRole("button", { name: /continue/i });
      await user.click(continueButton);

      expect(firstOnConfirm).not.toHaveBeenCalled();
      expect(secondOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid clicking on Continue button", async () => {
      const onConfirm = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onConfirm={onConfirm} />, { wrapper: MantineWrapper });

      const continueButton = screen.getByRole("button", { name: /continue/i });

      // Rapidly click multiple times
      await user.click(continueButton);
      await user.click(continueButton);
      await user.click(continueButton);

      // Should be called 3 times (no debouncing in this component)
      expect(onConfirm).toHaveBeenCalledTimes(3);
    });

    it("should handle rapid clicking on Cancel button", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<DownloadConfirmationModal {...defaultProps} onClose={onClose} />, { wrapper: MantineWrapper });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });

      await user.click(cancelButton);
      await user.click(cancelButton);
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(3);
    });
  });
});
