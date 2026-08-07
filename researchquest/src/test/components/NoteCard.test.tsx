import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NoteCard } from "../../components/notes/NoteCard";
import type { Note } from "../../types/database";
import { TooltipProvider } from "../../components/ui/tooltip";

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
      <TooltipProvider delayDuration={0}>
        <NoteCard
          note={mockNote}
          onDuplicate={vi.fn()}
          isSelected={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText("Test Note")).toBeInTheDocument();
  });

  it("has an accessible delete button", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <NoteCard
          note={mockNote}
          onDuplicate={vi.fn()}
          isSelected={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );
    // Should fail if aria-label is missing
    const deleteButton = screen.getByRole("button", { name: /Delete note/i });
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(mockNote.id);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is keyboard accessible and has correct role", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <NoteCard
          note={mockNote}
          onDuplicate={vi.fn()}
          isSelected={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    // The title is the focusable trigger; the card container stays non-interactive
    const card = screen.getByRole("button", {
      name: /Open note: Test Note/i,
    });
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-note-card", mockNote.id);

    // Buttons activate with Enter/Space natively, which resolves to a click event
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(mockNote);
  });

  it("does not trigger selection when key event bubbles from children", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <NoteCard
          note={mockNote}
          onDuplicate={vi.fn()}
          isSelected={false}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </TooltipProvider>,
    );

    const deleteButton = screen.getByRole("button", { name: /Delete note/i });

    // Simulate bubbling key event
    fireEvent.keyDown(deleteButton, { key: "Enter", bubbles: true });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
