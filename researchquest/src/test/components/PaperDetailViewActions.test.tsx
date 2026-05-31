import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaperDetailView } from "../../components/entities/PaperDetailView";
import type { Paper } from "../../types/database";
import { TooltipProvider } from "../../components/ui/tooltip";

// Mock dependencies
vi.mock("../../components/topics/TopicSelector", () => ({
  TopicSelector: () => <div data-testid="topic-selector">Topics</div>,
}));

vi.mock("../../components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("../../components/papers/CitationDialog", () => ({
  CitationDialog: () => null,
}));

// Mock Store and Hooks
const {
  mockSetSelectedNote,
  mockSetSelectedPaper,
  mockSetCurrentView,
  mockCreateNote,
} = vi.hoisted(() => ({
  mockSetSelectedNote: vi.fn(),
  mockSetSelectedPaper: vi.fn(),
  mockSetCurrentView: vi.fn(),
  mockCreateNote: vi.fn(),
}));

vi.mock("../../store/appStore", () => ({
  useAppStore: {
    getState: () => ({
      user: { id: "user1" },
      setSelectedNote: mockSetSelectedNote,
      setSelectedPaper: mockSetSelectedPaper,
      setCurrentView: mockSetCurrentView,
    }),
  },
}));

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    createNote: mockCreateNote,
  }),
}));

describe("PaperDetailView Actions", () => {
  const mockPaper: Paper = {
    id: "paper1",
    user_id: "user1",
    title: "Test Paper",
    authors: ["Author A"],
    publication_date: "2023-01-01",
    status: "To Read",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    source_url: "https://example.com",
    doi: "10.1234/5678",
    abstract: "This is a test abstract.",
    topic_ids: [],
  };

  const mockOnUpdate = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the Create Linked Note button", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PaperDetailView
          paper={mockPaper}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      </TooltipProvider>
    );

    // Look for the button by aria-label since we replaced title
    const createButton = screen.getByRole("button", { name: "Create linked note" });
    expect(createButton).toBeInTheDocument();
  });

  it("should call createNote and navigate when button is clicked", async () => {
    const newNote = { id: "note1", title: "Notes on: Test Paper" };
    mockCreateNote.mockResolvedValue(newNote);

    render(
      <TooltipProvider delayDuration={0}>
        <PaperDetailView
          paper={mockPaper}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      </TooltipProvider>
    );

    const createButton = screen.getByRole("button", { name: "Create linked note" });
    fireEvent.click(createButton);

    expect(mockCreateNote).toHaveBeenCalledWith({
      title: "Notes on: Test Paper",
      markdown_body: expect.stringContaining("# Test Paper"),
      linked_entity_ids: ["paper1"],
    });

    // Wait for async actions
    await new Promise(process.nextTick);

    expect(mockSetSelectedNote).toHaveBeenCalledWith(newNote);
    expect(mockSetSelectedPaper).toHaveBeenCalledWith(null);
    expect(mockSetCurrentView).toHaveBeenCalledWith("notes");
  });
});
