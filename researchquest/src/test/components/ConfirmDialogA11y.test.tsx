import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";

describe("ConfirmDialog Accessibility", () => {
  it("should focus cancel button by default for danger variant", async () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Delete Item"
        message="Are you sure?"
        variant="danger"
        cancelText="Cancel"
        confirmText="Delete"
      />,
    );

    // Wait for the dialog to be visible and focus to settle
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toHaveFocus();
    });
  });

  it("should focus cancel button by default for warning variant", async () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Warning"
        message="Be careful!"
        variant="warning"
        cancelText="Cancel"
        confirmText="Proceed"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toHaveFocus();
    });
  });

  it("should focus confirm button by default for info variant", async () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Info"
        message="Just so you know."
        variant="info"
        cancelText="Close"
        confirmText="OK"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("OK")).toHaveFocus();
    });
  });

  it("should have correct ARIA roles", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Accessible Dialog"
        message="Description text"
        variant="info"
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "dialog-description");
  });

  it("should trap focus inside the dialog", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Trap Test"
        message="Focus should stay inside."
        variant="info"
        cancelText="Cancel"
        confirmText="Confirm"
      />,
    );

    // Initial focus on Confirm (info variant)
    await waitFor(() => {
      expect(screen.getByText("Confirm")).toHaveFocus();
    });

    // DOM Order:
    // 1. Close Button (in header)
    // 2. Cancel Button
    // 3. Confirm Button

    // Current focus: Confirm (last)
    // Tab -> Close (first)
    await user.tab();
    expect(screen.getByLabelText("Close dialog")).toHaveFocus();

    // Tab -> Cancel
    await user.tab();
    expect(screen.getByText("Cancel")).toHaveFocus();

    // Tab -> Confirm
    await user.tab();
    expect(screen.getByText("Confirm")).toHaveFocus();

    // Shift+Tab -> Cancel
    await user.tab({ shift: true });
    expect(screen.getByText("Cancel")).toHaveFocus();

    // Shift+Tab -> Close
    await user.tab({ shift: true });
    expect(screen.getByLabelText("Close dialog")).toHaveFocus();

    // Shift+Tab -> Confirm (loop back to last)
    await user.tab({ shift: true });
    expect(screen.getByText("Confirm")).toHaveFocus();
  });

  it("should restore focus to trigger element on close", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setIsOpen(true)}>Open Dialog</button>
          <ConfirmDialog
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              handleClose();
            }}
            onConfirm={() => {}}
            title="Restore Test"
            message="Focus back."
            variant="danger"
          />
        </div>
      );
    };

    render(<TestComponent />);

    const openButton = screen.getByText("Open Dialog");
    await user.click(openButton);

    // Dialog opens, focus moves inside (to Cancel by default for danger)
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toHaveFocus();
    });

    // Close dialog by clicking Cancel
    await user.click(screen.getByText("Cancel"));

    // Dialog closes, focus should return to openButton
    await waitFor(() => {
      expect(openButton).toHaveFocus();
    });
  });
});
