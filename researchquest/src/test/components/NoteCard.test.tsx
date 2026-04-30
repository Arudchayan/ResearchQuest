import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NoteCard } from "../../components/notes/NoteCard";
import type { Note } from "../../types/database";

const mockNote: Note = {
  id: "1",
  user_id: "user1",
  title: "Test Note",
  markdown_body: "This is a test note.",
  tags: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("NoteCard Accessibility", () => {
  const onSelect = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders note content", () => {
    render(
      <NoteCard
        note={mockNote}
        onDuplicate={vi.fn()}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("Test Note")).toBeInTheDocument();
  });

  it("has an accessible delete button", () => {
    render(
      <NoteCard
        note={mockNote}
        onDuplicate={vi.fn()}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );
    // Should fail if aria-label is missing
    const deleteButton = screen.getByRole("button", { name: /Delete note/i });
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(mockNote.id);
  });

  it("is keyboard accessible and has correct role", () => {
    render(
      <NoteCard
        note={mockNote}
        onDuplicate={vi.fn()}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    // Should fail if role="button" or aria-label is missing on the card container
    const card = screen.getByRole("button", {
      name: /Select note: Test Note/i,
    });
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("tabIndex", "0");

    // Test Keyboard interaction
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(mockNote);

    fireEvent.keyDown(card, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(mockNote);
  });

  it("does not trigger selection when key event bubbles from children", () => {
    render(
      <NoteCard
        note={mockNote}
        onDuplicate={vi.fn()}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: /Delete note/i });

    // Simulate bubbling key event
    fireEvent.keyDown(deleteButton, { key: "Enter", bubbles: true });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
