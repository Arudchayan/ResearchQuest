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

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: mockNotes,
  }),
}));

vi.mock("../../hooks/usePapers", () => ({
  usePapers: () => ({
    papers: mockPapers,
  }),
}));

vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: () => ({ ideas: mockIdeas }),
}));

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

  it("fix: does not open when Cmd+K is pressed while an editable target has focus", async () => {
    render(<CommandPalette />);

    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    fireEvent.keyDown(ta, { key: "k", metaKey: true });
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

  it("handles 0 matches correctly", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Type a command or search...");
      fireEvent.change(input, { target: { value: "NonExistentItemXYZ" } });
    });

    await waitFor(() => {
      expect(screen.getByText("No results found.")).toBeInTheDocument();
    });
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
});
