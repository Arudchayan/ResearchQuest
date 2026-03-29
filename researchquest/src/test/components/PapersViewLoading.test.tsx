import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PapersView } from "../../components/papers/PapersView";

// Define mock state with loading true
const { mockState } = vi.hoisted(() => {
  return {
    mockState: {
      papers: [],
      selectedPaper: null,
      setSelectedPaper: vi.fn(),
      user: { id: "user1" },
      papersLoading: true, // Simulate loading state
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

describe("PapersView Loading State", () => {
  it("renders loading skeletons when papersLoading is true", () => {
    render(<PapersView />);
    // Expect to find elements with role="status" (from Skeleton component)
    const skeletons = screen.getAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
