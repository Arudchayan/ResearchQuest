import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "../../components/editor/MarkdownEditor";
import { useAppStore } from "../../store/appStore";
import type { Note } from "../../types/database";

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(undefined),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: { UPDATE_NOTE: 0 },
}));

vi.mock("../../components/topics/TopicSelector", () => ({
  TopicSelector: () => null,
}));

vi.mock("../../components/editor/sub-components/EditorContent", () => ({
  default: ({
    content,
    setContent,
  }: {
    content: string;
    setContent: (value: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-mock"
      value={content}
      onChange={(event) => setContent(event.target.value)}
    />
  ),
}));

const savedNote: Note = {
  id: "note-autosave",
  user_id: "demo-user-0001",
  title: "Kept title",
  markdown_body: "Kept body",
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function resetStore() {
  useAppStore.setState({
    selectedNote: { ...savedNote },
    notes: [{ ...savedNote }],
    user: { id: "demo-user-0001" } as never,
    effectiveTheme: "light",
    topics: [],
  });
}

describe("MarkdownEditor autosave dirty-check", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not save a clean note on debounce tick or unmount", () => {
    const before = useAppStore.getState().notes[0];
    const { unmount } = render(<MarkdownEditor />);
    expect(screen.getByLabelText("Note title")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    unmount();

    // No optimistic write happened: the stored row is untouched.
    expect(useAppStore.getState().notes[0]).toBe(before);
  });

  it("autosaves a dirty draft on the debounce tick", () => {
    render(<MarkdownEditor />);

    fireEvent.change(screen.getByTestId("codemirror-mock"), {
      target: { value: "Edited body" },
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(useAppStore.getState().notes[0]?.markdown_body).toBe("Edited body");
  });

  it("flushes a dirty draft on beforeunload", () => {
    render(<MarkdownEditor />);

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Flushed title" },
    });
    fireEvent(window, new Event("beforeunload"));

    expect(useAppStore.getState().notes[0]?.title).toBe("Flushed title");
  });
});
