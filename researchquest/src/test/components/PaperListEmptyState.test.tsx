import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaperList } from "../../components/entities/PaperList";

vi.mock("../ui/Skeleton", () => ({
  ListSkeleton: () => <div>Loading...</div>,
}));

vi.mock("../ui/ConfirmDialog", () => ({
  ConfirmDialog: () => <div />,
  useConfirmDialog: () => ({
    confirm: vi.fn(),
    isOpen: false,
    config: {},
  }),
}));

describe("PaperList Empty State", () => {
  it("shows generic empty state when papers are empty and no search query provided", () => {
    render(
      <PaperList
        papers={[]}
        onSelectPaper={vi.fn()}
        onDeletePaper={vi.fn()}
        onRestorePaper={vi.fn()}
        onStatusChange={vi.fn()}
        searchQuery=""
      />,
    );

    // Should show "No papers yet"
    expect(screen.getByText("No papers yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first paper above")).toBeInTheDocument();
  });

  it("shows search-specific empty state when searching", () => {
    render(
      <PaperList
        papers={[]}
        onSelectPaper={vi.fn()}
        onDeletePaper={vi.fn()}
        onRestorePaper={vi.fn()}
        onStatusChange={vi.fn()}
        searchQuery="something"
      />,
    );

    // Should show "No matches found"
    expect(screen.getByText("No matches found")).toBeInTheDocument();
    expect(
      screen.getByText("Try a different keyword or clear your search."),
    ).toBeInTheDocument();

    // Should NOT show the generic message
    expect(screen.queryByText("No papers yet")).not.toBeInTheDocument();
  });

  it("has accessible status role", () => {
    render(
      <PaperList
        papers={[]}
        onSelectPaper={vi.fn()}
        onDeletePaper={vi.fn()}
        onRestorePaper={vi.fn()}
        onStatusChange={vi.fn()}
        searchQuery="something"
      />,
    );
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
  });
});
