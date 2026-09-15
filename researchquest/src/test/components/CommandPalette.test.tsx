import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import { CommandPalette } from "../../components/layout/CommandPalette";
import { useAppStore } from "../../store/appStore";

// Mock dependencies
// No useNavigate mock needed anymore as we don't use it
let mockNotes = [{ id: "1", title: "Test Note", markdown_body: "" }];
let mockPapers = [{ id: "1", title: "Test Paper", authors: [] }];
let mockIdeas = [{ id: "1", title: "Test Idea" }];
let mockTasks = [{ id: "task-1", title: "Test Task" }];

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
  createIdea: vi.fn(),
  createTask: vi.fn(),
  rpc: vi.fn(),
  exportData: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: mockNotes,
    createNote: mocks.createNote,
  }),
}));

vi.mock("../../hooks/usePapers", () => ({
  usePapers: () => ({
    papers: mockPapers,
  }),
}));

vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: () => ({ ideas: mockIdeas, createIdea: mocks.createIdea }),
}));

vi.mock("../../hooks/useTasks", () => ({
  useTasks: () => ({ tasks: mockTasks, createTask: mocks.createTask }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
  isDemoMode: true,
}));

vi.mock("../../utils/export", () => ({
  exportData: mocks.exportData,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

async function openPalette() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
  await waitFor(() => {
    expect(
      screen.getByPlaceholderText("Type a command or search..."),
    ).toBeInTheDocument();
  });
}

describe("CommandPalette", () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotes = [{ id: "1", title: "Test Note", markdown_body: "" }];
    mockPapers = [{ id: "1", title: "Test Paper", authors: [] }];
    mockIdeas = [{ id: "1", title: "Test Idea" }];
    mockTasks = [{ id: "task-1", title: "Test Task" }];
    // Demo-mode default: global_search RPC unavailable -> client fallback.
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.exportData.mockResolvedValue(undefined);
    mocks.createNote.mockResolvedValue({ id: "note-new", title: "Untitled Note" });
    mocks.createIdea.mockResolvedValue({ id: "idea-new", title: "Untitled Idea" });
    mocks.createTask.mockResolvedValue({ id: "task-new", title: "Untitled Task" });
    useAppStore.setState({
      effectiveTheme: "light",
      setTheme: vi.fn(),
      setCurrentView: vi.fn(),
      setSelectedNote: vi.fn(),
      setSelectedPaper: vi.fn(),
      setSelectedIdea: vi.fn(),
      user: { id: "test-user" } as any,
      tasks: [{ id: "task-1", title: "Test Task" } as any],
      topics: {},
    });
  });

  it("is closed by default", () => {
    render(<CommandPalette />);
    expect(
      screen.queryByPlaceholderText("Type a command or search..."),
    ).not.toBeInTheDocument();
  });

  it("opens when Cmd+K is pressed", async () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Type a command or search..."),
      ).toBeInTheDocument();
    });
  });

  it("fix: opens when Cmd+K is pressed while an editable target has focus (palette reserves Ctrl+K)", async () => {
    render(<CommandPalette />);

    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    fireEvent.keyDown(ta, { key: "k", metaKey: true });
    ta.remove();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Type a command or search..."),
      ).toBeInTheDocument();
    });
  });

  it("still does not hijack '/' while typing in an editable", async () => {
    render(<CommandPalette />);

    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    fireEvent.keyDown(ta, { key: "/" });
    ta.remove();

    expect(
      screen.queryByPlaceholderText("Type a command or search..."),
    ).not.toBeInTheDocument();
  });

  it("opens when Cmd+K is pressed while a non-editable target has focus", async () => {
    render(
      <>
        <CommandPalette />
        <button type="button">Palette Trigger</button>
      </>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Palette Trigger" }), {
      key: "k",
      metaKey: true,
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Type a command or search..."),
      ).toBeInTheDocument();
    });
  });

  it("keeps the palette within the 320px reflow width and exposes a visible focus ring", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await screen.findByRole("dialog", { name: "Command Menu" });
    const palette = document.querySelector("[cmdk-root]");
    expect(palette).toHaveClass("w-[calc(100vw-2rem)]", "max-w-xl");
    expect(screen.getByPlaceholderText("Type a command or search...")).toHaveClass("focus-visible:outline-2");
  });

  it("gives the search input an accessible name via the palette label", async () => {
    // cmdk overrides input aria-label with its own labelledby pointing at the
    // dialog label, so assert the effective computed name instead.
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Command Menu" }),
      ).toBeInTheDocument();
    });
  });

  it("renders navigation commands", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Go to Notes")).toBeInTheDocument();
      expect(screen.getByText("Go to Papers")).toBeInTheDocument();
    });
  });

  it("renders search results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
      expect(screen.getByText("Test Paper")).toBeInTheDocument();
      expect(screen.getByText("Test Idea")).toBeInTheDocument();
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });
  });

  it("offers Create from query instead of a dead end when nothing matches", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.change(
      screen.getByPlaceholderText("Type a command or search..."),
      { target: { value: "NonExistentItemXYZ" } },
    );

    await waitFor(() => {
      expect(screen.getByText(/Create note/)).toBeInTheDocument();
    });
  });

  it("creates a real note from the query action and deep-links to it", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.change(
      screen.getByPlaceholderText("Type a command or search..."),
      { target: { value: "Brand new thing XYZ" } },
    );

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Create note/));
    });

    await waitFor(() => {
      expect(mocks.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Brand new thing XYZ" }),
      );
    });
    expect(window.location.pathname).toBe("/notes/note-new");
    expect(useAppStore.getState().setSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-new" }),
    );
  });

  it("handles exactly 1 match correctly", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Type a command or search...");
      fireEvent.change(input, { target: { value: "Test Note" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
      expect(screen.queryByText("Test Paper")).not.toBeInTheDocument();
    });
  });

  it("handles exactly 50 matches correctly", async () => {
    mockNotes = Array.from({ length: 50 }, (_, index) => ({
      id: `bulk-note-${index}`,
      title: `Bulk Note ${index}`,
      markdown_body: "",
    }));
    mockPapers = [];
    mockIdeas = [];
    mockTasks = [];
    useAppStore.setState({ tasks: [], topics: {} });

    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Bulk Note 49")).toBeInTheDocument();
      expect(screen.getAllByText(/Bulk Note/).length).toBe(50);
    });
  });

  it("limits rendered search results to 50 matches when >50 matches exist", async () => {
    mockNotes = Array.from({ length: 60 }, (_, index) => ({
      id: `bulk-note-${index}`,
      title: `Bulk Note ${index}`,
      markdown_body: "",
    }));
    mockPapers = [];
    mockIdeas = [];
    mockTasks = [];
    useAppStore.setState({
      tasks: [],
      topics: {},
    });

    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByText("Bulk Note 49")).toBeInTheDocument();
      expect(screen.queryByText("Bulk Note 50")).not.toBeInTheDocument();
      expect(screen.getAllByText(/Bulk Note/).length).toBe(50);
    });
  });

  it("ranks before capping: finds a query match beyond the first 50 items", async () => {
    mockNotes = Array.from({ length: 60 }, (_, index) => ({
      id: `bulk-note-${index}`,
      title: `Bulk Note ${index}`,
      markdown_body: "",
    }));
    mockPapers = [];
    mockIdeas = [];
    mockTasks = [];
    useAppStore.setState({ tasks: [], topics: {} });

    render(<CommandPalette />);
    await openPalette();

    fireEvent.change(
      screen.getByPlaceholderText("Type a command or search..."),
      { target: { value: "Bulk Note 59" } },
    );

    // "Bulk Note 59" would have been cut off by the old pre-slice(0, 50).
    await waitFor(() => {
      expect(screen.getByText("Bulk Note 59")).toBeInTheDocument();
    });
  });

  it("filters results when typing", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Type a command or search...");
      fireEvent.change(input, { target: { value: "Test Note" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
    });
  });

  it("creates a real note via New Note and deep-links to it", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.click(screen.getByText("New Note"));

    await waitFor(() => {
      expect(mocks.createNote).toHaveBeenCalled();
    });
    expect(window.location.pathname).toBe("/notes/note-new");
    expect(useAppStore.getState().setSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-new" }),
    );
  });

  it("creates real ideas and tasks via New Idea / New Task", async () => {
    render(<CommandPalette />);
    await openPalette();
    fireEvent.click(screen.getByText("New Idea"));
    await waitFor(() => {
      expect(mocks.createIdea).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Untitled Idea" }),
      );
    });
    expect(window.location.pathname).toBe("/ideas/idea-new");

    await openPalette();
    fireEvent.click(screen.getByText("New Task"));
    await waitFor(() => {
      expect(mocks.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Untitled Task" }),
      );
    });
    expect(window.location.pathname).toBe("/tasks/task-new");
  });

  it("labels nav-only Paper/Topic actions as Go to destinations", async () => {
    render(<CommandPalette />);
    await openPalette();

    expect(screen.getByText("Go to Papers to add")).toBeInTheDocument();
    expect(screen.getByText("Go to Topics to manage")).toBeInTheDocument();
    expect(screen.queryByText("New Paper")).not.toBeInTheDocument();
    expect(screen.queryByText("New Topic")).not.toBeInTheDocument();
  });

  it("navigates to /tasks/:id when a task result is selected", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.click(screen.getByText("Test Task"));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/tasks/task-1");
    });
  });

  it("renders global_search RPC results with snippets", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          entity_type: "note",
          entity_id: "1",
          title: "Test Note",
          snippet: "matching excerpt",
          rank: 0.9,
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    render(<CommandPalette />);
    await openPalette();

    fireEvent.change(
      screen.getByPlaceholderText("Type a command or search..."),
      { target: { value: "Test Note" } },
    );

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "global_search",
        expect.objectContaining({ search_query: "Test Note" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("matching excerpt")).toBeInTheDocument();
      // Server rows replace the client list: Test Paper was not returned.
      expect(screen.queryByText("Test Paper")).not.toBeInTheDocument();
    });
  });

  it("falls back to client results when global_search is unavailable (demo mode)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    render(<CommandPalette />);
    await openPalette();

    fireEvent.change(
      screen.getByPlaceholderText("Type a command or search..."),
      { target: { value: "Test Note" } },
    );

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "global_search",
        expect.objectContaining({ search_query: "Test Note" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Test Note")).toBeInTheDocument();
    });
  });

  it("toasts on quick export success instead of silently closing", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.click(screen.getByText("Quick Export All Data"));

    await waitFor(() => {
      expect(mocks.exportData).toHaveBeenCalled();
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Backup download started");
  });

  it("toasts an error when exporting with no signed-in user", async () => {
    useAppStore.setState({ user: null });
    render(<CommandPalette />);
    await openPalette();

    fireEvent.click(screen.getByText("Quick Export All Data"));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
    });
    expect(mocks.exportData).not.toHaveBeenCalled();
  });

  it("opens the Data Management dialog when selected (no silent no-op)", async () => {
    render(<CommandPalette />);
    await openPalette();

    fireEvent.click(screen.getByText("Data Management..."));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Data Management" }),
      ).toBeInTheDocument();
    });
  });
});
