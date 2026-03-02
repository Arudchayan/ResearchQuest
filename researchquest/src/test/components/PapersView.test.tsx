import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PapersView } from "../../components/papers/PapersView";
import type { Paper } from "../../types/database";

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
    {
      id: "2",
      title: "Slow React",
      authors: ["Snail"],
      publication_date: "2023-01-01",
      user_id: "user1",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      doi: "10.1000/2",
      abstract: "Slow",
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
    searchPaperByDOI: vi.fn(),
    searchPapersByQuery: vi.fn(),
  }),
}));

// Mock other components used in PapersView to avoid rendering them fully
vi.mock("../entities/AddPaperView", () => ({
  AddPaperView: () => <div>AddPaperView</div>,
}));
vi.mock("../entities/PaperDetailView", () => ({
  PaperDetailView: () => <div>PaperDetailView</div>,
}));
vi.mock("../layout/OnboardingGuide", () => ({
  OnboardingGuide: () => <div>OnboardingGuide</div>,
}));
// Mock dialog
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Close: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <div>{children}</div>,
}));

describe("PapersView", () => {
  it("renders papers list", () => {
    render(<PapersView />);
    expect(screen.getByText("Optimized React")).toBeInTheDocument();
    expect(screen.getByText("Slow React")).toBeInTheDocument();
  });
});
