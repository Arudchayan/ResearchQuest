import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  default: ({ value, onChange, ...props }: any) => {
    return (
      <textarea
        data-testid="codemirror-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...Object.keys(props).reduce((acc, key) => { if (key !== "basicSetup" && key !== "extensions") acc[key] = props[key]; return acc; }, {})}
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

  it("fix: enforces input length validation and does NOT send large payload to Supabase", async () => {
    vi.useFakeTimers();
    render(<MarkdownEditor />);

    // Create a large string exceeding the limit
    const largeContent = "a".repeat(NOTE_BODY_MAX_LENGTH + 100);

    // Simulate CodeMirror change
    const textarea = screen.getByTestId("codemirror-mock");

    const { fireEvent, act } = await import("@testing-library/react");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: largeContent } });
    });

    // Wait for debounce (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Assert that update was NOT called with the large content
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
