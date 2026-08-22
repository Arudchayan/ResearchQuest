import { TooltipProvider } from "../../components/ui/tooltip";
import { render, act, fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../../store/appStore";
import { Profiler } from "react";
import type { Note } from "../../types/database";

const selectedNote: Note = {
  id: "note-1",
  user_id: "user-1",
  title: "Deep-linked note",
  markdown_body: "Note content",
  tags: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Mock dependencies
vi.mock("../../components/editor/MarkdownEditor", () => ({
  MarkdownEditor: ({ onBackToList }: { readonly onBackToList?: () => void }) => (
    <div>
      <div>Editor</div>
      <button type="button" onClick={() => onBackToList?.()}>
        Back to list
      </button>
    </div>
  ),
}));
vi.mock("../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {},
  }),
}));
vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [],
    createNote: vi.fn(),
    deleteNote: vi.fn(),
    restoreNote: vi.fn(),
    loading: false,
  }),
}));
vi.mock("../../components/notes/NotesSidebar", () => ({
  NotesSidebar: ({
    onSelectNote,
  }: {
    readonly onSelectNote: (note: Note) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onSelectNote({
          id: "note-1",
          user_id: "user-1",
          title: "Deep-linked note",
          markdown_body: "Note content",
          tags: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        })
      }
    >
      Select note
    </button>
  ),
}));

// Import after mocks
import { NotesView } from "../../components/notes/NotesView";

describe("NotesView Re-renders", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/notes");
    useAppStore.setState({
      notes: [],
      selectedNote: null,
      notesLoading: false,
      isMobileSidebarOpen: false,
      papers: [],
      ideas: [],
      tasks: [],
      user: null
    });
  });

  it("should NOT re-render when unrelated store property changes", () => {
    let renderCount = 0;
    const onRender = vi.fn(() => {
      renderCount++;
    });

    // Initial render
    render(
      <TooltipProvider delayDuration={0}>
        <Profiler id="NotesView" onRender={onRender}>
          <NotesView />
        </Profiler>
      </TooltipProvider>,
    );

    // Capture initial render count
    const initialRenderCount = renderCount;

    // Update unrelated property
    act(() => {
      useAppStore.setState({ isMobileSidebarOpen: true });
    });

    // Expect render count to NOT increase
    // Note: Profiler callback runs after commit. Act handles waiting for updates.
    expect(renderCount).toBe(initialRenderCount);
  });

  it("keeps the mobile list open on /notes when selectedNote becomes stale", () => {
    window.history.replaceState(null, "", "/notes");
    useAppStore.setState({ selectedNote });

    render(
      <TooltipProvider delayDuration={0}>
        <NotesView />
      </TooltipProvider>,
    );

    const editorPane = screen.getByLabelText("Note editor");
    expect(editorPane).toHaveClass("hidden");

    act(() => {
      useAppStore.setState({
        selectedNote: { ...selectedNote, updated_at: "2026-01-02T00:00:00Z" },
      });
    });

    expect(editorPane).toHaveClass("hidden");
  });

  it("syncs mobile editor visibility with browser history changes", () => {
    window.history.replaceState(null, "", "/notes/note-1");
    useAppStore.setState({ selectedNote });

    render(
      <TooltipProvider delayDuration={0}>
        <NotesView />
      </TooltipProvider>,
    );

    const editorPane = screen.getByLabelText("Note editor");
    expect(editorPane).toHaveClass("flex");

    act(() => {
      window.history.pushState(null, "", "/notes");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(editorPane).toHaveClass("hidden");
    expect(useAppStore.getState().selectedNote).toBeNull();

    act(() => {
      window.history.pushState(null, "", "/notes/note-1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(editorPane).toHaveClass("flex");
  });

  it("keeps note routes in sync and does not reopen after an autosave update", () => {
    window.history.replaceState(null, "", "/notes");
    render(
      <TooltipProvider delayDuration={0}>
        <NotesView />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select note" }));
    expect(window.location.pathname).toBe("/notes/note-1");

    const editorPane = screen.getByLabelText("Note editor");
    expect(editorPane).toHaveClass("flex");

    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(window.location.pathname).toBe("/notes");
    expect(editorPane).toHaveClass("hidden");
    expect(useAppStore.getState().selectedNote?.id).toBe("note-1");

    act(() => {
      useAppStore.setState({
        selectedNote: {
          ...selectedNote,
          updated_at: "2026-01-02T00:00:00Z",
        },
      });
    });

    expect(editorPane).toHaveClass("hidden");
  });
});
