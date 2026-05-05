import { TooltipProvider } from "../../components/ui/tooltip";
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotesView } from "../../components/notes/NotesView";
import { useAppStore } from "../../store/appStore";

// Mock NoteCard to track renders
const { MockNoteCard, noteCardRenderCounts } = vi.hoisted(() => {
  const noteCardRenderCounts: Record<string, number> = {};

  const MockNoteCard = vi.fn((props: any) => {
    const id = props.note.id;
    noteCardRenderCounts[id] = (noteCardRenderCounts[id] || 0) + 1;
    return (
      <div data-testid={`note-card-${id}`}>
        {props.note.title}
        <button onClick={() => props.onDelete(id)}>Delete</button>
      </div>
    );
  });

  return { MockNoteCard, noteCardRenderCounts };
});

// Define stable mocks
const {
  mockConfirm,
  mockCreateNote,
  mockDeleteNote,
  mockRestoreNote,
  mockUseConfirmDialog,
} = vi.hoisted(() => {
  const mockConfirmFn = vi.fn();
  return {
    mockConfirm: mockConfirmFn,
    mockCreateNote: vi.fn(),
    mockDeleteNote: vi.fn(),
    mockRestoreNote: vi.fn(),
    // We spy on this hook to count NotesView renders
    mockUseConfirmDialog: vi.fn(() => ({
      confirm: mockConfirmFn,
      isOpen: false,
      config: {},
    })),
  };
});

// Mock the module
vi.mock("../../components/notes/NoteCard", async (importOriginal) => {
  const React = await import("react");
  // We use React.memo to simulate the real component behavior
  const MemoizedMock = React.memo(MockNoteCard);
  return {
    NoteCard: MemoizedMock,
  };
});

// Mock other components to isolate test
vi.mock("../../components/editor/MarkdownEditor", () => ({
  MarkdownEditor: () => <div>Editor</div>,
}));

vi.mock("../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: mockUseConfirmDialog,
}));

// Mock useNotes to behave like the real hook (reading from store) or provide a way to inject notes
vi.mock("../../hooks/useNotes", async () => {
  const { useAppStore } = await import("../../store/appStore");
  return {
    useNotes: () => {
      // Use the real store selector to ensure subscription works
      const notes = useAppStore((state) => state.notes);
      return {
        createNote: mockCreateNote,
        deleteNote: mockDeleteNote,
        restoreNote: mockRestoreNote,
        notesLoading: false,
        notes: notes,
      };
    },
  };
});

describe("NotesView Performance", () => {
  beforeEach(() => {
    // Reset render counts
    Object.keys(noteCardRenderCounts).forEach(
      (key) => delete noteCardRenderCounts[key],
    );
    mockUseConfirmDialog.mockClear();

    // Reset store
    useAppStore.setState({
      notes: [],
      selectedNote: null,
      user: { id: "test-user", email: "test@example.com" } as any,
      isMobileSidebarOpen: false,
    });
  });

  it("should not re-render unrelated notes when one note is updated", () => {
    // 1. Setup initial state with 3 notes
    const initialNotes = [
      {
        id: "1",
        title: "Note 1",
        markdown_body: "Body 1",
        updated_at: "2023-01-01",
      },
      {
        id: "2",
        title: "Note 2",
        markdown_body: "Body 2",
        updated_at: "2023-01-02",
      },
      {
        id: "3",
        title: "Note 3",
        markdown_body: "Body 3",
        updated_at: "2023-01-03",
      },
    ] as any[];

    useAppStore.setState({ notes: initialNotes });

    // 2. Render the component
    render(<TooltipProvider delayDuration={0}><NotesView /></TooltipProvider>);

    // Check initial render counts
    expect(noteCardRenderCounts["1"]).toBe(1);
    expect(noteCardRenderCounts["2"]).toBe(1);
    expect(noteCardRenderCounts["3"]).toBe(1);

    // 3. Update ONE note in the store (simulating an edit)
    const updatedNotes = initialNotes.map((n) =>
      n.id === "2" ? { ...n, title: "Note 2 Updated" } : n,
    );

    act(() => {
      useAppStore.setState({ notes: updatedNotes });
    });

    // 4. Check render counts again
    expect(noteCardRenderCounts["2"]).toBe(2); // Should update
    expect(noteCardRenderCounts["1"]).toBe(1); // Should remain same
    expect(noteCardRenderCounts["3"]).toBe(1); // Should remain same
  });

  it("should NOT re-render NotesView when unrelated store state changes", () => {
    const initialNotes = [
      {
        id: "1",
        title: "Note 1",
        markdown_body: "Body 1",
        updated_at: "2023-01-01",
      },
    ] as any[];

    useAppStore.setState({ notes: initialNotes });

    render(<TooltipProvider delayDuration={0}><NotesView /></TooltipProvider>);

    // Initial render
    const initialRenderCount = mockUseConfirmDialog.mock.calls.length;
    expect(initialRenderCount).toBeGreaterThan(0);

    // Update unrelated state
    act(() => {
      useAppStore.setState({ isMobileSidebarOpen: true });
    });

    // Check render count again
    const finalRenderCount = mockUseConfirmDialog.mock.calls.length;

    // Expect NO re-render (count should be same)
    expect(finalRenderCount).toBe(initialRenderCount);
  });
});
