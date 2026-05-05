import { TooltipProvider } from "../../components/ui/tooltip";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotesView } from "../../components/notes/NotesView";
import userEvent from "@testing-library/user-event";
import type { Note } from "../../types/database";

const { mockNote } = vi.hoisted(() => {
  return {
    mockNote: {
      id: "test-note-1",
      user_id: "test-user-id",
      title: "Test Note",
      markdown_body: "This is a test note.",
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Note,
  };
});

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [mockNote],
    createNote: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

vi.mock("../../store/appStore", () => {
  const mockState = {
    notes: [mockNote],
    selectedNote: null,
    setSelectedNote: vi.fn(),
    user: { id: "test-user-id" },
  };
  const useAppStore = (selector: any) =>
    selector ? selector(mockState) : mockState;
  useAppStore.getState = () => mockState;
  return { useAppStore };
});

vi.mock("../editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div>Editor</div>,
}));

// Mock NoteCard to render title
vi.mock("./NoteCard", () => ({
  NoteCard: ({ note }: any) => <div>{note.title}</div>,
}));

vi.mock("../ui/ConfirmDialog", () => ({
  ConfirmDialog: () => <div />,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {},
  }),
}));

describe("NotesView Search", () => {
  it("shows clear button when typing and clears input on click", async () => {
    const user = userEvent.setup();
    render(<TooltipProvider delayDuration={0}><NotesView /></TooltipProvider>);

    const searchInput = screen.getByPlaceholderText("Search notes...");

    // Type something
    await user.type(searchInput, "Note");
    expect(searchInput).toHaveValue("Note");

    // Expect clear button to appear
    const clearButton = screen.getByLabelText("Clear search");
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    await user.click(clearButton);

    // Expect input to be empty
    expect(searchInput).toHaveValue("");

    // Expect input to be focused
    expect(searchInput).toHaveFocus();

    // Expect clear button to be gone
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });
});
