import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "../../components/editor/MarkdownEditor";
import { useAppStore } from "../../store/appStore";
import { useBacklinks } from "../../hooks/useBacklinks";
import type { Note, Paper } from "../../types/database";

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

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

const savedNote: Note = {
  id: "note-cite",
  user_id: "demo-user-0001",
  title: "Lit review",
  markdown_body: "Draft",
  tags: [],
  linked_entity_ids: ["idea-keep"],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const libraryPaper: Paper = {
  id: "paper-cite-target",
  user_id: "demo-user-0001",
  title: "Attention Is All You Need",
  authors: ["Vaswani, Ashish"],
  doi: "10.5555/cite",
  source_url: "https://example.com/attention",
  status: "To Read",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  publication_date: "2017-06-12",
};

function resetStore() {
  useAppStore.setState({
    selectedNote: { ...savedNote, linked_entity_ids: ["idea-keep"] },
    notes: [{ ...savedNote, linked_entity_ids: ["idea-keep"] }],
    papers: [libraryPaper],
    papersLoading: false,
    notesLoading: false,
    ideas: [],
    ideasLoading: false,
    user: { id: "demo-user-0001" } as never,
    effectiveTheme: "light",
    topics: [],
  });
}

async function citeLibraryPaper() {
  fireEvent.click(
    screen.getByRole("button", { name: /Insert Citation \(Ctrl/i }),
  );
  fireEvent.click(await screen.findByText("Attention Is All You Need"));
}

describe("MarkdownEditor citation linking", () => {
  beforeEach(() => {
    resetStore();
  });

  it("writes the cited paper into the note linked_entity_ids", async () => {
    render(<MarkdownEditor />);

    await citeLibraryPaper();

    await waitFor(() => {
      expect(useAppStore.getState().notes[0]?.linked_entity_ids).toEqual([
        "idea-keep",
        "paper-cite-target",
      ]);
    });
  });

  it("does not duplicate a paper that is already linked", async () => {
    useAppStore.setState({
      selectedNote: {
        ...savedNote,
        linked_entity_ids: ["idea-keep", "paper-cite-target"],
      },
      notes: [
        {
          ...savedNote,
          linked_entity_ids: ["idea-keep", "paper-cite-target"],
        },
      ],
    });

    render(<MarkdownEditor />);
    await citeLibraryPaper();

    await waitFor(() => {
      expect(useAppStore.getState().notes[0]?.linked_entity_ids).toEqual([
        "idea-keep",
        "paper-cite-target",
      ]);
    });
  });

  it("makes the citing note appear in the paper backlinks", async () => {
    render(<MarkdownEditor />);
    await citeLibraryPaper();

    await waitFor(() => {
      expect(
        useAppStore.getState().notes[0]?.linked_entity_ids,
      ).toContain("paper-cite-target");
    });

    const { result } = renderHook(() =>
      useBacklinks("paper-cite-target", "paper", "demo-user-0001"),
    );
    expect(result.current.backlinks.map((item) => item.id)).toEqual([
      "note-cite",
    ]);
  });
});
