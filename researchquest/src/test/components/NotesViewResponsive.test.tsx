import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotesView } from "../../components/notes/NotesView";
import type { Note } from "../../types/database";

const { mockNote, mockState } = vi.hoisted(() => {
  const mockNote = {
    id: "test-note-1",
    user_id: "test-user-id",
    title: "Responsive Note",
    markdown_body: "This note should be editable on narrow screens.",
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Note;

  return {
    mockNote,
    mockState: {
      notes: [mockNote],
      selectedNote: mockNote,
      setSelectedNote: vi.fn(),
      user: { id: "test-user-id" },
      dataSyncErrors: {
        notes: null,
        papers: null,
        ideas: null,
      },
    },
  };
});

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [mockNote],
    loading: false,
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    restoreNote: vi.fn(),
  }),
}));

vi.mock("../../store/appStore", () => {
  const useAppStore = (selector: any) =>
    selector ? selector(mockState) : mockState;
  useAppStore.getState = () => mockState;
  return { useAppStore };
});

vi.mock("../../components/editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div>Editor</div>,
}));

vi.mock("../../components/notes/NoteCard", () => ({
  NoteCard: ({ note }: { note: Note }) => <div>{note.title}</div>,
}));

vi.mock("../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => <div />,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {},
  }),
}));

vi.mock("../../components/ui/Skeleton", () => ({
  ListSkeleton: () => <div>Loading...</div>,
}));

describe("NotesView responsive layout", () => {
  it("uses a mobile-first single column and restores the split layout on large screens", () => {
    const { container } = render(<NotesView />);

    const root = container.firstElementChild;
    expect(root).toHaveClass("flex-col");
    expect(root).toHaveClass("lg:flex-row");
    expect(root).toHaveClass("overflow-hidden");

    const [listPane, editorPane] = Array.from(root?.children ?? []);

    expect(listPane).toHaveClass("w-full");
    expect(listPane).toHaveClass("max-h-[45vh]");
    expect(listPane).toHaveClass("lg:w-80");
    expect(listPane).toHaveClass("lg:max-h-none");
    expect(listPane).toHaveClass("flex-shrink-0");

    expect(editorPane).toHaveClass("w-full");
    expect(editorPane).toHaveClass("min-w-0");
    expect(editorPane).toHaveClass("flex-1");
  });

  it("renders a notes sync error instead of silently showing an empty state", () => {
    mockState.dataSyncErrors.notes = {
      resource: "notes",
      message: "Notes unavailable",
    };

    render(<NotesView />);

    expect(screen.getByText("Notes unavailable")).toBeInTheDocument();

    mockState.dataSyncErrors.notes = null;
  });
});
