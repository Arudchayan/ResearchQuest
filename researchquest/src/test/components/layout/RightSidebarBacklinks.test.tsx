import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RightSidebar } from "../../../components/layout/RightSidebar";
import { TooltipProvider } from "../../../components/ui/tooltip";
import { useAppStore } from "../../../store/appStore";
import type { Note, Paper } from "../../../types/database";

vi.mock("../../../hooks/useRelatedItems", () => ({
  useRelatedItems: () => ({ relatedItems: [], loading: false }),
}));

const weeklyReflection: Note = {
  id: "note-0006",
  user_id: "user-1",
  title: "Weekly reflection",
  markdown_body: "## Wins",
  tags: ["reflection"],
  linked_entity_ids: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const weirdPaper: Paper = {
  id: "paper-0002",
  user_id: "user-1",
  title: "The WEIRD Problem: Cognitive Science and Human Cognition",
  authors: ["Joseph Henrich", "Steven J. Heine", "Ara Norenzayan"],
  status: "To Read",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function seedPapersView(note: Note) {
  useAppStore.setState({
    user: { id: "user-1" } as never,
    isRightSidebarOpen: true,
    currentView: "papers",
    selectedNote: note,
    selectedPaper: weirdPaper,
    selectedIdea: null,
    notes: [note],
    papers: [weirdPaper],
    ideas: [],
    notesLoading: false,
    ideasLoading: false,
  });
}

function renderSidebar() {
  return render(
    <TooltipProvider>
      <RightSidebar />
    </TooltipProvider>,
  );
}

describe("RightSidebar backlinks", () => {
  beforeEach(() => {
    seedPapersView({ ...weeklyReflection, linked_entity_ids: [] });
  });

  it("keys Backlinks off the selected paper, not a leftover note", () => {
    seedPapersView({
      ...weeklyReflection,
      linked_entity_ids: [weirdPaper.id],
    });

    renderSidebar();

    expect(
      screen.getByRole("button", {
        name: "Navigate to note Weekly reflection",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No items link to this yet/i),
    ).not.toBeInTheDocument();
  });

  it("updates Backlinks after a note in the store gains a link to the paper", () => {
    renderSidebar();

    expect(screen.getByText(/No items link to this yet/i)).toBeInTheDocument();

    act(() => {
      const linked = {
        ...weeklyReflection,
        linked_entity_ids: [weirdPaper.id],
      };
      useAppStore.setState({
        notes: [linked],
        selectedNote: linked,
      });
    });

    expect(
      screen.getByRole("button", {
        name: "Navigate to note Weekly reflection",
      }),
    ).toBeInTheDocument();
  });
});
