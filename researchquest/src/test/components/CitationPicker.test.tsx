import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { CitationPicker } from "../../components/editor/CitationPicker";

// Mock dependencies
vi.mock("../../store/appStore", () => {
  return {
    useAppStore: vi.fn((selector) => {
      if (typeof selector === "function") {
        return selector({ user: { id: "test-user" } });
      }
      return { user: { id: "test-user" } };
    }),
  };
});

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}));

const mockPapers = [
  {
    id: "paper-1",
    title: "Quantum Computing",
    authors: ["Smith, John", "Doe, Jane"],
    publication_date: "2023-01-01",
    doi: "10.1000/1",
    source_url: "https://example.com/1",
  },
  {
    id: "paper-2",
    title: "Machine Learning",
    authors: ["Turing, Alan"],
    publication_date: "1950-01-01",
    // No DOI
    source_url: "https://example.com/2",
  },
];

vi.mock("../../hooks/usePapers", () => ({
  usePapers: vi.fn(() => ({
    papers: mockPapers,
    loading: false,
  })),
}));

// Mock cmdk components if needed, but usually they render fine in JSDOM if resize observer is mocked
// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock pointer capture methods
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

describe("CitationPicker", () => {
  it("renders papers correctly", () => {
    render(
      <CitationPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />,
    );

    expect(screen.getByText("Quantum Computing")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search papers/i)).toBeInTheDocument();
  });

  it("calls onSelect with formatted citation when paper is clicked", () => {
    const handleSelect = vi.fn();
    render(
      <CitationPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    // Click the first paper
    fireEvent.click(screen.getByText("Quantum Computing"));

    // Expected format: [(Smith et al., 2023)](https://doi.org/10.1000/1)
    expect(handleSelect).toHaveBeenCalledWith(
      "[(Smith et al., 2023)](https://doi.org/10.1000/1)",
    );
  });

  it("calls onSelect with formatted citation for single author and no DOI", () => {
    const handleSelect = vi.fn();
    render(
      <CitationPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    // Click the second paper
    fireEvent.click(screen.getByText("Machine Learning"));

    // Expected format: [(Turing, 1950)](https://example.com/2)
    expect(handleSelect).toHaveBeenCalledWith(
      "[(Turing, 1950)](https://example.com/2)",
    );
  });
});
