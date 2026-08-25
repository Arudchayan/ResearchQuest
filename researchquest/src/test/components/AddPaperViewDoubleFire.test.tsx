import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import type { CrossrefPaper } from "../../types/database";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";

describe("AddPaperView Add Paper double-fire guard (ARU-657)", () => {
  const mockOnAdd = vi.fn();
  const mockSearchByDOI = vi.fn();
  const mockSearchByQuery = vi.fn();

  const crossrefResult: CrossrefPaper = {
    doi: "10.1234/double-fire",
    title: "Double-Fire Test Paper",
    authors: ["Ada Lovelace"],
    abstract: "Abstract text.",
    publicationDate: 2024,
    sourceUrl: "https://example.com/paper",
    containerTitle: "Example Journal",
    publisher: "Example Press",
    type: "journal-article",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAdd.mockResolvedValue({ id: "created-paper-id" });
    mockSearchByDOI.mockResolvedValue(crossrefResult);
    useAppStore.setState({ selectedPaper: null, papers: [] });
  });

  it("fires onAdd exactly once when Add Paper is double-clicked", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      </TooltipProvider>,
    );

    await userEvent.type(
      screen.getByPlaceholderText(/e.g., 10.1038/i),
      "10.1234/double-fire",
    );
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    const addButton = await screen.findByRole("button", {
      name: /add paper to library/i,
    });

    fireEvent.click(addButton);
    fireEvent.click(addButton);

    await waitFor(() => expect(mockOnAdd).toHaveBeenCalledTimes(1));
    expect(addButton).toBeDisabled();
  });
});