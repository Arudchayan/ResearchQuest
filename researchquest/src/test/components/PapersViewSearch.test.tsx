import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PapersView } from "../../components/papers/PapersView";
import userEvent from "@testing-library/user-event";

const { mockState } = vi.hoisted(() => {
  const papers: any[] = [
    {
      id: "1",
      title: "Optimized React",
      authors: ["Bolt"],
      publication_date: "2023-01-01",
      user_id: "user1",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      doi: "10.1000/1",
      abstract: "Speed",
      status: "read",
      citation_count: 0,
    },
  ];
  return {
    mockState: {
      papers,
      selectedPaper: null,
      setSelectedPaper: vi.fn(),
      user: { id: "user1" },
    },
  };
});

vi.mock("../../store/appStore", () => {
  const useAppStore = (selector: any) =>
    selector ? selector(mockState) : mockState;
  useAppStore.getState = () => mockState;
  return { useAppStore };
});

vi.mock("../../hooks/usePapers", () => ({
  usePapers: () => ({
    createPaper: vi.fn(),
    updatePaper: vi.fn(),
    deletePaper: vi.fn(),
    restorePaper: vi.fn(),
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  }),
}));

// Mock child components
vi.mock("../entities/AddPaperView", () => ({
  AddPaperView: () => <div>AddPaperView</div>,
}));
vi.mock("../entities/PaperDetailView", () => ({
  PaperDetailView: () => <div>PaperDetailView</div>,
}));
vi.mock("../layout/OnboardingGuide", () => ({
  OnboardingGuide: () => <div>OnboardingGuide</div>,
}));
vi.mock("./PaperCard", () => ({
  PaperCard: ({ paper }: any) => <div>{paper.title}</div>,
}));

// Mock Radix Dialog
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Close: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <div>{children}</div>,
}));

describe("PapersView Search", () => {
  it("shows clear button when typing and clears input on click", async () => {
    const user = userEvent.setup();
    render(<PapersView />);

    const searchInput = screen.getByPlaceholderText("Search library...");

    // Type something
    await user.type(searchInput, "React");
    expect(searchInput).toHaveValue("React");

    // Expect clear button to appear
    const clearButton = screen.getByLabelText("Clear search");
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    await user.click(clearButton);

    // Expect input to be empty
    expect(searchInput).toHaveValue("");

    // Expect input to be focused
    expect(searchInput).toHaveFocus();

    // Expect clear button to be gone
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });
});
