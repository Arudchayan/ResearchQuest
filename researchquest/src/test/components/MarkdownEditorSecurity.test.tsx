import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MarkdownEditor } from "../../components/editor/MarkdownEditor";
import { useAppStore } from "../../store/appStore";
import { supabase } from "../../lib/supabase";

// Mock Supabase
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "test-user" } } }),
    },
  },
}));

// Mock awardXP
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(undefined),
  XP_REWARDS: { UPDATE_NOTE: 5 },
}));

// Mock CodeMirror to allow us to simulate changes
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange, basicSetup, onCreateEditor, ...props }: any) => {
    return (
      <textarea
        data-testid="codemirror-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    );
  },
}));

// Mock CodeMirror language
vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn(),
}));

// Mock CodeMirror view
vi.mock("@codemirror/view", () => ({
  EditorView: {
    lineWrapping: {},
    theme: vi.fn(),
  },
  keymap: {
    of: vi.fn(),
  },
}));

// Mock ReactMarkdown to avoid rendering complexity
vi.mock("react-markdown", () => ({
  default: ({ children }: any) => (
    <div data-testid="markdown-preview">{children}</div>
  ),
}));

// Mock the lazy-loaded EditorContent to avoid suspense issues in tests
vi.mock("../../components/editor/sub-components/EditorContent", () => ({
  default: ({ content, setContent }: any) => {
    return (
      <textarea
        data-testid="codemirror-mock"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    );
  },
}));

const NOTE_BODY_MAX_LENGTH = 100000;

describe("MarkdownEditor Security", () => {
  const mockNote = {
    id: "note-1",
    user_id: "test-user",
    title: "Test Note",
    markdown_body: "Initial content",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    linked_entity_ids: [],
  };

  const mockUpdate = vi.fn();
  // Mock chainable methods for Supabase
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue({
        data: { ...mockNote, title: "Updated" },
        error: null,
      }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: mockUpdate,
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
  };

  const mockFrom = vi.fn().mockReturnValue(mockChain);

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      selectedNote: mockNote,
      effectiveTheme: "light",
      notes: [mockNote],
      user: { id: "test-user" } as any,
      topics: [], // Ensure topics are empty to avoid complex rendering
    });
    // @ts-expect-error: mocking implementation
    supabase.from.mockImplementation(mockFrom);
    mockUpdate.mockImplementation(() => mockChain);

    // Reset specific mocks if needed
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.single.mockResolvedValue({
      data: { ...mockNote, title: "Updated" },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips autosave when the selected note is unchanged", async () => {
    vi.useFakeTimers();

    render(<MarkdownEditor />);
    await act(async () => {});
    screen.getByTestId("codemirror-mock");

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("autosaves changed note content", async () => {
    vi.useFakeTimers();

    render(<MarkdownEditor />);
    await act(async () => {});
    const textarea = screen.getByTestId("codemirror-mock");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Changed content #tag" } });
      vi.advanceTimersByTime(1100);
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      title: "Test Note",
      markdown_body: "Changed content #tag",
      tags: ["tag"],
    });
  });

  it("fix: enforces input length validation and does NOT send large payload to Supabase", async () => {
    render(<MarkdownEditor />);

    // Use findByTestId which waits for suspense/lazy resolution
    const textarea = await screen.findByTestId("codemirror-mock");

    // Install fake timers to control debounce
    vi.useFakeTimers();

    // Let the initial auto-save debounce settle
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    // Clear the initial save call so we can assert no LARGE payload was sent
    mockUpdate.mockClear();

    // Create a large string exceeding the limit
    const largeContent = "a".repeat(NOTE_BODY_MAX_LENGTH + 100);

    await act(async () => {
      fireEvent.change(textarea, { target: { value: largeContent } });
    });

    // Wait for debounce (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Assert that update was NOT called with the large content
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
