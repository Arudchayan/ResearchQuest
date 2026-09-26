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

// Server search-parity coverage: global_search now returns task/topic rows,
// and the client union fallback for tasks/topics stays intact.
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

function searchFor(value: string) {
  fireEvent.change(
    screen.getByPlaceholderText("Type a command or search..."),
    { target: { value } },
  );
}

describe("CommandPalette server search parity (tasks/topics)", () => {
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

  it("renders server task and topic rows with snippets (no longer dropped)", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          entity_type: "task",
          entity_id: "task-1",
          title: "Test Task",
          snippet: "task excerpt",
          rank: 0.8,
          updated_at: new Date().toISOString(),
        },
        {
          entity_type: "topic",
          entity_id: "topic-9",
          title: "Test Topic",
          snippet: "topic excerpt",
          rank: 0.7,
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    render(<CommandPalette />);
    await openPalette();
    searchFor("Test");

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "global_search",
        expect.objectContaining({ search_query: "Test" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
      expect(screen.getByText("task excerpt")).toBeInTheDocument();
      expect(screen.getByText("Test Topic")).toBeInTheDocument();
      expect(screen.getByText("topic excerpt")).toBeInTheDocument();
      // Server rows replace the client list for covered types.
      expect(screen.queryByText("Test Paper")).not.toBeInTheDocument();
      expect(screen.queryByText("Test Note")).not.toBeInTheDocument();
    });
    // task-1 exists in both server rows and the client index: deduped to one.
    expect(screen.getAllByText("Test Task")).toHaveLength(1);
  });

  it("unions client task/topic extras when the server returns other types", async () => {
    useAppStore.setState({
      topics: {
        "topic-9": {
          id: "topic-9",
          name: "Test Topic",
          description: "client-side topic",
        } as any,
      },
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          entity_type: "note",
          entity_id: "1",
          title: "Test Note",
          snippet: "server note excerpt",
          rank: 0.9,
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    render(<CommandPalette />);
    await openPalette();
    searchFor("Test");

    await waitFor(() => {
      expect(screen.getByText("server note excerpt")).toBeInTheDocument();
    });
    // Union fallback intact: client task/topic matches join server rows.
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
      expect(screen.getByText("Test Topic")).toBeInTheDocument();
    });
  });
});
