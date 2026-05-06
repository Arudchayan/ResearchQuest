import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarkdownEditor } from "../../components/editor/MarkdownEditor";

// Mock dependencies
vi.mock("../../store/appStore", () => {
  const fn = vi.fn();
  (fn as any).getState = vi.fn().mockReturnValue({
    topics: [],
    notes: [],
    papers: [],
    ideas: [],
  });
  return {
    useAppStore: fn,
  };
});

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

// Mock Supabase
vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "test-user" } } }),
    },
    from: () => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        update: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return queryBuilder;
    },
  },
}));

// Mock CodeMirror to avoid rendering issues in JSDOM
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="code-mirror-mock"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock Gamification
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn(),
  XP_REWARDS: {},
}));

// Mock text utils
vi.mock("../../utils/text", () => ({
  countWords: () => 10,
  estimateReadingTime: () => "1 min",
}));

describe("MarkdownEditor Print", () => {
  const mockPrint = vi.fn();
  const mockWrite = vi.fn();
  const mockClose = vi.fn();
  const mockOpen = vi.fn();

  const mockNote = {
    id: "note-1",
    title: "Test Note Title",
    markdown_body: "# Heading\n\nSome **bold** text.",
    tags: [],
    user_id: "test-user",
    created_at: "2023-01-01",
    updated_at: "2023-01-01",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock window.open
    mockOpen.mockReturnValue({
      document: {
        write: mockWrite,
        close: vi.fn(),
      },
      print: mockPrint,
      close: mockClose,
    });
    global.window.open = mockOpen;

    // Mock store
    const { useAppStore } = await import("../../store/appStore");
    const mockState = {
      selectedNote: mockNote,
      setSelectedNote: vi.fn(),
      effectiveTheme: "light",
      topics: [],
      setTopics: vi.fn(),
      setTopicsLoading: vi.fn(),
      upsertTopic: vi.fn(),
      removeTopic: vi.fn(),
      setSelectedTopic: vi.fn(),
      user: { id: "test-user" },
    };
    (useAppStore as any).mockImplementation((selector: any) => {
      if (selector && typeof selector === "function") {
        return selector(mockState);
      }
      return mockState;
    });
    (useAppStore as any).getState = () => mockState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens print window with correct content when print button is clicked", async () => {
    render(<MarkdownEditor />);

    // Ensure note is loaded
    expect(screen.getByDisplayValue("Test Note Title")).toBeInTheDocument();

    // Find print button
    const printButton = screen.getByRole("button", { name: /Print Note/i });
    fireEvent.click(printButton);

    // Check if window.open was called
    expect(mockOpen).toHaveBeenCalledWith("", "_blank");

    // Check if document.write was called with expected HTML content
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("Test Note Title"),
    );
    expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining("Heading")); // From rendered markdown
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("<strong>bold</strong>"),
    ); // Rendered markdown HTML

    // Wait for the print call (it's inside window.onload in the written HTML string, but JSDOM doesn't execute script tags in write())
    // Actually, my implementation adds a script tag: window.onload = function() { window.print(); ... }
    // JSDOM does NOT execute scripts inside document.write or dynamically added script tags by default unless configured.
    // However, the test verifies that the HTML string *contains* the script that calls print.
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("window.print()"),
    );
  });
});
