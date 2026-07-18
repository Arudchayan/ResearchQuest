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
  default: ({ value, onChange, ...props }: any) => {
    // Remove complex props that cause warnings on textarea
    const { basicSetup, onCreateEditor, extensions, theme, ...validProps } =
      props;
    return (
      <textarea
        data-testid="codemirror-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...validProps}
      />
    );
  },
}));

// Mock the lazy-loaded EditorContent so it renders synchronously in JSDOM
vi.mock("../../components/editor/sub-components/EditorContent", () => ({
  default: ({ content, setContent, previewRef }: any) => (
    <div>
      <textarea
        data-testid="codemirror-mock"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {/* Include a preview area so handlePrint can read innerHTML */}
      <div
        ref={previewRef}
        data-testid="preview-content"
        dangerouslySetInnerHTML={{
          __html: "<h1>Heading</h1><p>Some <strong>bold</strong> text.</p>",
        }}
      />
    </div>
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
        getElementById: vi
          .fn()
          .mockReturnValue({ textContent: "", innerHTML: "" }),
        title: "",
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

    // Ensure note is loaded and lazy component is ready
    const titleInput = await screen.findByDisplayValue("Test Note Title");
    expect(titleInput).toBeInTheDocument();

    // The EditorContent is lazy-loaded, so we must wait for it to be rendered
    // to ensure previewRef is attached.
    const mockCodeMirror = await screen.findByTestId("codemirror-mock");
    expect(mockCodeMirror).toBeInTheDocument();

    // Find print button
    const printButton = screen.getByRole("button", { name: /Print Note/i });

    // We need to wait for the markdown preview to be rendered, since that's what's printed
    const previewHeading = await screen.findByText("Heading");
    expect(previewHeading).toBeInTheDocument();

    // Now click the print button
    fireEvent.click(printButton);

    // We need to wrap user interaction in act, wait a bit for references to attach
    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith("", "_blank");
    });

    // Check if document.write was called with expected HTML content (the template)
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('id="print-title"'),
    );
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining('id="print-content"'),
    );

    // Wait for the print call (it's inside window.onload in the written HTML string, but JSDOM doesn't execute script tags in write())
    // Actually, my implementation adds a script tag: window.onload = function() { window.print(); ... }
    // JSDOM does NOT execute scripts inside document.write or dynamically added script tags by default unless configured.
    // However, the test verifies that the HTML string *contains* the script that calls print.
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("window.print()"),
    );
  });
});
