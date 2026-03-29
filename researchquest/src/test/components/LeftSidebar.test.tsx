import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../mocks/supabase";
import {
  mockSupabaseClient,
  mockPaper,
  mockIdea,
  mockNote,
} from "../mocks/supabase";

// Mock the hooks
vi.mock("../../hooks/useNotes", () => ({
  useNotes: vi.fn(() => ({
    notes: [mockNote],
    loading: false,
    createNote: vi.fn().mockResolvedValue(mockNote),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    restoreNote: vi.fn(),
  })),
}));

vi.mock("../../hooks/usePapers", () => ({
  usePapers: vi.fn(() => ({
    papers: [mockPaper],
    loading: false,
    createPaper: vi.fn().mockResolvedValue(mockPaper),
    updatePaper: vi.fn(),
    deletePaper: vi.fn(),
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  })),
}));

vi.mock("../../hooks/useIdeas", () => ({
  useIdeas: vi.fn(() => ({
    ideas: [mockIdea],
    loading: false,
    createIdea: vi.fn().mockResolvedValue(mockIdea),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn(),
  })),
}));

const { LeftSidebar } = await import("../../components/layout/LeftSidebar");
const { useAppStore } = await import("../../store/appStore");
const { useNotes } = await import("../../hooks/useNotes");
const { usePapers } = await import("../../hooks/usePapers");
const { useIdeas } = await import("../../hooks/useIdeas");

const buildNotesMock = () => ({
  notes: [mockNote],
  loading: false,
  createNote: vi.fn().mockResolvedValue(mockNote),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  restoreNote: vi.fn(),
});

const buildPapersMock = () => ({
  papers: [mockPaper],
  loading: false,
  createPaper: vi.fn().mockResolvedValue(mockPaper),
  updatePaper: vi.fn(),
  deletePaper: vi.fn(),
  searchPaperByDOI: vi.fn(),
  searchPapersByQuery: vi.fn(),
});

const buildIdeasMock = () => ({
  ideas: [mockIdea],
  loading: false,
  createIdea: vi.fn().mockResolvedValue(mockIdea),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
});

describe("LeftSidebar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });
    vi.mocked(useNotes).mockReturnValue(buildNotesMock() as any);
    vi.mocked(usePapers).mockReturnValue(buildPapersMock() as any);
    vi.mocked(useIdeas).mockReturnValue(buildIdeasMock() as any);
    // Reset store state
    useAppStore.setState({
      currentView: "notes",
      selectedNote: null,
      selectedPaper: null,
      selectedIdea: null,
    });
  });

  describe("Navigation Tabs", () => {
    it("should render all navigation tabs", () => {
      render(<LeftSidebar />);

      expect(
        screen.getByRole("button", { name: /^Notes$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Papers$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Ideas$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Tasks$/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Focus$/i }),
      ).toBeInTheDocument();
    });

    it("should highlight active tab", () => {
      useAppStore.setState({ currentView: "papers" });
      render(<LeftSidebar />);

      const papersTab = screen.getByRole("button", { name: /^Papers$/i });
      expect(papersTab).toHaveClass("bg-primary-50");
    });

    it("should switch views when clicking tabs", async () => {
      render(<LeftSidebar />);

      const papersTab = screen.getByRole("button", { name: /^Papers$/i });
      await userEvent.click(papersTab);

      await waitFor(() => {
        expect(useAppStore.getState().currentView).toBe("papers");
      });
    });

    it("should update URL when switching tabs", async () => {
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      render(<LeftSidebar />);

      const papersTab = screen.getByRole("button", { name: /^Papers$/i });
      await userEvent.click(papersTab);

      expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/papers");
    });

    it("should clear selected items when switching tabs", async () => {
      useAppStore.setState({
        currentView: "papers",
        selectedPaper: mockPaper,
      });

      render(<LeftSidebar />);

      const notesTab = screen.getByRole("button", { name: /^Notes$/i });
      await userEvent.click(notesTab);

      await waitFor(() => {
        expect(useAppStore.getState().selectedNote).toBeNull();
      });
    });
  });

  describe("Search Functionality", () => {
    it("should render search input", () => {
      render(<LeftSidebar />);

      const searchInput = screen.getByPlaceholderText(/search notes/i);
      expect(searchInput).toBeInTheDocument();
    });

    it("should update search query on input", async () => {
      render(<LeftSidebar />);

      const searchInput = screen.getByPlaceholderText(/search notes/i);
      await userEvent.type(searchInput, "test query");

      expect(searchInput).toHaveValue("test query");
    });

    it("should update placeholder based on current view", async () => {
      render(<LeftSidebar />);

      // Switch to papers
      const papersTab = screen.getByRole("button", { name: /^Papers$/i });
      await userEvent.click(papersTab);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search papers/i);
        expect(searchInput).toBeInTheDocument();
      });
    });
  });

  describe("Add Button", () => {
    it("should show add button for notes, papers, and ideas", () => {
      useAppStore.setState({ currentView: "notes" });
      const { rerender } = render(<LeftSidebar />);

      expect(
        screen.getByRole("button", { name: /new note/i }),
      ).toBeInTheDocument();

      useAppStore.setState({ currentView: "papers" });
      rerender(<LeftSidebar />);
      expect(
        screen.getByRole("button", { name: /new paper/i }),
      ).toBeInTheDocument();

      useAppStore.setState({ currentView: "ideas" });
      rerender(<LeftSidebar />);
      expect(
        screen.getByRole("button", { name: /new idea/i }),
      ).toBeInTheDocument();
    });

    it("should hide add button for tasks and focus", () => {
      useAppStore.setState({ currentView: "tasks" });
      const { rerender } = render(<LeftSidebar />);

      expect(
        screen.queryByRole("button", { name: /new/i }),
      ).not.toBeInTheDocument();

      useAppStore.setState({ currentView: "focus" });
      rerender(<LeftSidebar />);
      expect(
        screen.queryByRole("button", { name: /new/i }),
      ).not.toBeInTheDocument();
    });

    it("should create new note when clicked in notes view", async () => {
      const createNoteMock = vi.fn().mockResolvedValue(mockNote);
      vi.mocked(useNotes).mockReturnValue({
        notes: [],
        loading: false,
        createNote: createNoteMock,
        updateNote: vi.fn(),
        deleteNote: vi.fn(),
      } as any);

      useAppStore.setState({ currentView: "notes" });
      render(<LeftSidebar />);

      const addButton = screen.getByRole("button", { name: /new note/i });
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(createNoteMock).toHaveBeenCalled();
      });
    });

    it("should clear selected paper when clicked in papers view", async () => {
      useAppStore.setState({
        currentView: "papers",
        selectedPaper: mockPaper,
      });

      render(<LeftSidebar />);

      const addButton = screen.getByRole("button", { name: /new paper/i });
      await userEvent.click(addButton);

      expect(useAppStore.getState().selectedPaper).toBeNull();
    });
  });

  describe("Entity Lists", () => {
    it("should display papers in papers view", () => {
      useAppStore.setState({ currentView: "papers" });
      render(<LeftSidebar />);

      expect(screen.getByText(mockPaper.title)).toBeInTheDocument();
    });

    it("should display ideas in ideas view", () => {
      useAppStore.setState({ currentView: "ideas" });
      render(<LeftSidebar />);

      expect(screen.getByText(mockIdea.title)).toBeInTheDocument();
    });

    it("should display notes in notes view", async () => {
      useAppStore.setState({ currentView: "notes" });
      render(<LeftSidebar />);

      const note = await screen.findByText(mockNote.title);
      expect(note).toBeInTheDocument();
    });

    it("should display focus helpers in focus view", () => {
      useAppStore.setState({ currentView: "focus" });
      render(<LeftSidebar />);

      expect(
        screen.getByText(/set a target in the main panel/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/upcoming focus candidates/i),
      ).toBeInTheDocument();
    });

    it("should show loading state while fetching", async () => {
      vi.mocked(usePapers).mockReturnValue({
        papers: [],
        loading: true,
        createPaper: vi.fn(),
        updatePaper: vi.fn(),
        deletePaper: vi.fn(),
        searchPaperByDOI: vi.fn(),
        searchPapersByQuery: vi.fn(),
      });

      useAppStore.setState({ currentView: "papers" });
      render(<LeftSidebar />);

      // Should show loading skeleton
      expect(screen.queryByText(mockPaper.title)).not.toBeInTheDocument();
    });
  });

  describe("Gamification Widget", () => {
    it("should display gamification stats", async () => {
      useAppStore.setState({
        user: {
          id: "test-user",
          email: "test@example.com",
          total_xp: 100,
          current_level: 5,
          theme: "light",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      });

      render(<LeftSidebar />);

      await waitFor(() => {
        expect(screen.getByText(/Focus Studio/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/Reading pipeline/i)).toBeInTheDocument();
      expect(screen.getByText(/Idea garden/i)).toBeInTheDocument();
      expect(screen.getByText(/Focus prompts/i)).toBeInTheDocument();
      expect(screen.getByText(/No XP logged yet/i)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for navigation", () => {
      render(<LeftSidebar />);

      const nav = screen.getByRole("navigation", { hidden: true });
      expect(nav).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      render(<LeftSidebar />);

      const papersTabButton = screen.getByRole("button", { name: /^Papers$/i });
      papersTabButton.focus();

      expect(papersTabButton).toHaveFocus();

      await userEvent.keyboard("{Enter}");

      await waitFor(() => {
        expect(useAppStore.getState().currentView).toBe("papers");
      });
    });
  });

  describe("Filtering", () => {
    it("should filter papers by search query", async () => {
      const paper1 = { ...mockPaper, id: "1", title: "Quantum Computing" };
      const paper2 = { ...mockPaper, id: "2", title: "Machine Learning" };

      vi.mocked(usePapers).mockReturnValue({
        papers: [paper1, paper2],
        loading: false,
        createPaper: vi.fn(),
        updatePaper: vi.fn(),
        deletePaper: vi.fn(),
        searchPaperByDOI: vi.fn(),
        searchPapersByQuery: vi.fn(),
      } as any);

      useAppStore.setState({ currentView: "papers" });
      render(<LeftSidebar />);

      const searchInput = screen.getByPlaceholderText(/search papers/i);
      await userEvent.type(searchInput, "Quantum");

      await waitFor(() => {
        expect(screen.getByText("Quantum Computing")).toBeInTheDocument();
        expect(screen.queryByText("Machine Learning")).not.toBeInTheDocument();
      });
    });
  });
});
