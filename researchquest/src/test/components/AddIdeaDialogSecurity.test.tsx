import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddIdeaDialog } from "../../components/ideas/AddIdeaDialog";

describe("AddIdeaDialog Security", () => {
  it("should have maxLength attributes on inputs to prevent DoS", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <AddIdeaDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />,
    );

    const titleInput = screen.getByLabelText(/Title/i);
    expect(titleInput).toHaveAttribute("maxLength", "255");

    const descriptionInput = screen.getByLabelText(/Description/i);
    expect(descriptionInput).toHaveAttribute("maxLength", "5000");
  });

  it("omits an empty optional description from the confirmation payload", () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <AddIdeaDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Title \*/i), {
      target: { value: "A focused research direction" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Idea" }));

    expect(handleConfirm).toHaveBeenCalledWith({
      title: "A focused research direction",
    });
  });
});
