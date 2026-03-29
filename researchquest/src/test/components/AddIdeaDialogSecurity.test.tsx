import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

    const titleInput = screen.getByLabelText(/Title \*/i);
    expect(titleInput).toHaveAttribute("maxLength", "255");

    const descriptionInput = screen.getByLabelText(/Description/i);
    expect(descriptionInput).toHaveAttribute("maxLength", "5000");
  });
});
