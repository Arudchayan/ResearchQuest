import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotesView } from "../../components/notes/NotesView";
import userEvent from "@testing-library/user-event";

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [],
    createNote: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

vi.mock("../../store/appStore", () => {
  const mockState = {
    notes: [], // Empty notes
    selectedNote: null,
    setSelectedNote: vi.fn(),
    user: { id: "test-user-id" },
    notesLoading: false,
  };
  const useAppStore = (selector: any) =>
    selector ? selector(mockState) : mockState;
  useAppStore.getState = () => mockState;
  return { useAppStore };
});

vi.mock("../editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div>Editor</div>,
}));

vi.mock("./NoteCard", () => ({
  NoteCard: () => <div>NoteCard</div>,
}));

vi.mock("../ui/ConfirmDialog", () => ({
  ConfirmDialog: () => <div />,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {},
  }),
}));

vi.mock("../ui/Skeleton", () => ({
  ListSkeleton: () => <div>Loading...</div>,
}));

describe("NotesView Empty State", () => {
  it("shows detailed empty state when there are no notes", () => {
    render(<NotesView />);

    // Should show "No notes yet"
    expect(screen.getByText("No notes yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first note to get started"),
    ).toBeInTheDocument();

    // Should show "Create Note" button (visible text)
    // We use getAllByRole because there might be another button with similar name in header
    // But we look for specific text content "Create Note" which is only in our new button
    expect(
      screen.getByRole("button", { name: "Create Note" }),
    ).toBeInTheDocument();
  });

  it("shows search-specific empty state when searching", async () => {
    const user = userEvent.setup();
    render(<NotesView />);

    const searchInput = screen.getByPlaceholderText("Search notes...");
    await user.type(searchInput, "something");

    expect(screen.getByText("No matches found")).toBeInTheDocument();
    expect(
      screen.getByText("Try a different keyword or clear your search."),
    ).toBeInTheDocument();

    // The "Create Note" button (with text) should NOT be present in empty state
    // Note: The header button is icon-only or has different label
    expect(
      screen.queryByRole("button", { name: "Create Note" }),
    ).not.toBeInTheDocument();
  });

  it("has accessible status role", () => {
    render(<NotesView />);
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
  });
});
