import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PapersView } from "../../components/papers/PapersView";
import type { Paper } from "../../types/database";

// Mock @tanstack/react-virtual to work in JSDOM
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: any) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count ?? 0 }, (_, index) => ({
        index,
        key: index,
        start: index * 220,
        size: 220,
      })),
    getTotalSize: () => (opts.count ?? 0) * 220,
  }),
}));

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
      papersLoading: false,
      selectedPaper: null,
      setSelectedPaper: vi.fn(),
      user: { id: "user1" },
      dataSyncErrors: {
        notes: null,
        papers: null,
        ideas: null,
      },
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
vi.mock("../../components/entities/AddPaperView", () => ({
  AddPaperView: () => <div>AddPaperView</div>,
}));
vi.mock("../../components/entities/PaperDetailView", () => ({
  PaperDetailView: () => <div>PaperDetailView</div>,
}));
vi.mock("../../components/layout/OnboardingGuide", () => ({
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

  it("uses a full-width mobile detail panel when a paper is selected", () => {
    mockState.selectedPaper = mockState.papers[0] as Paper;

    render(<PapersView />);

    const detailPanel = screen.getByText("Paper Details").closest("div")
      ?.parentElement?.parentElement;

    expect(detailPanel).toHaveClass("w-full");
    expect(detailPanel).toHaveClass("lg:w-[500px]");
    expect(detailPanel).toHaveClass("absolute");
    expect(detailPanel).toHaveClass("lg:relative");

    mockState.selectedPaper = null;
  });

  it("renders a papers sync error instead of silently showing an empty state", () => {
    mockState.dataSyncErrors.papers = {
      resource: "papers",
      message: "Papers unavailable",
    };

    render(<PapersView />);

    expect(screen.getByText("Papers unavailable")).toBeInTheDocument();

    mockState.dataSyncErrors.papers = null;
  });
});
