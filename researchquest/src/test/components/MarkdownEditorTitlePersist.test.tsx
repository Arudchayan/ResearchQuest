import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarkdownEditor } from "../../components/editor/MarkdownEditor";
import { useAppStore } from "../../store/appStore";
import { displayNoteTitle, PLACEHOLDER_NOTE_TITLE } from "../../utils/text";
import type { Note } from "../../types/database";

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(undefined),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: { UPDATE_NOTE: 5 },
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

const firstRunNote: Note = {
  id: "note-first-run",
  user_id: "demo-user-0001",
  title: "",
  markdown_body: "",
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("MarkdownEditor title persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      selectedNote: { ...firstRunNote },
      notes: [{ ...firstRunNote }],
      user: { id: "demo-user-0001" } as never,
      effectiveTheme: "light",
      topics: [],
    });
  });

  it("keeps the edited title after leaving and returning before the debounce fires", async () => {
    const { unmount } = render(<MarkdownEditor />);

    const titleInput = await screen.findByLabelText("Note title");
    fireEvent.change(titleInput, {
      target: { value: "Demo research synthesis" },
    });
    fireEvent.change(await screen.findByTestId("codemirror-mock"), {
      target: { value: "# Demo research synthesis\n\nBody" },
    });

    unmount();

    const stored = useAppStore
      .getState()
      .notes.find((note) => note.id === "note-first-run");
    expect(stored?.title).toBe("Demo research synthesis");
    expect(stored?.title).not.toBe(PLACEHOLDER_NOTE_TITLE);
    expect(displayNoteTitle(stored ?? firstRunNote)).toBe(
      "Demo research synthesis",
    );

    useAppStore.setState({ selectedNote: stored ?? null });
    render(<MarkdownEditor />);
    expect(
      await screen.findByDisplayValue("Demo research synthesis"),
    ).toBeInTheDocument();
  });

  it("does not persist Untitled Note as the stored title", async () => {
    useAppStore.setState({
      selectedNote: {
        ...firstRunNote,
        title: "Old title",
        markdown_body: "",
      },
      notes: [
        {
          ...firstRunNote,
          title: "Old title",
          markdown_body: "",
        },
      ],
    });

    const { unmount } = render(<MarkdownEditor />);

    const titleInput = await screen.findByLabelText("Note title");
    fireEvent.change(titleInput, { target: { value: PLACEHOLDER_NOTE_TITLE } });

    unmount();

    const stored = useAppStore.getState().notes[0];
    expect(stored?.title).toBe("");
    expect(stored?.title).not.toBe(PLACEHOLDER_NOTE_TITLE);
    expect(stored?.title).not.toBe("Old title");
  });
});
