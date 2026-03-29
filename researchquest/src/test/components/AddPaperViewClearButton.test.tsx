import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import type { CrossrefPaper } from "../../types/database";
import { useAppStore } from "../../store/appStore";

describe("AddPaperView Clear Button", () => {
  const mockOnAdd = vi.fn();
  const mockSearchByDOI = vi.fn();
  const mockSearchByQuery = vi.fn();
  const reloadSpy = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    reloadSpy.mockReset();
    const locationMock: Location = {
      ancestorOrigins: originalLocation.ancestorOrigins,
      hash: originalLocation.hash,
      host: originalLocation.host,
      hostname: originalLocation.hostname,
      href: originalLocation.href,
      origin: originalLocation.origin,
      pathname: originalLocation.pathname,
      port: originalLocation.port,
      protocol: originalLocation.protocol,
      search: originalLocation.search,
      assign: originalLocation.assign.bind(originalLocation),
      reload: reloadSpy,
      replace: originalLocation.replace.bind(originalLocation),
      toString: () => originalLocation.toString(),
    };

    Object.defineProperty(window, "location", {
      configurable: true,
      value: locationMock,
    });
    mockOnAdd.mockResolvedValue({ id: "new-paper-id" });
    useAppStore.setState({ selectedPaper: null });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("should show and work clear button in DOI search", async () => {
    render(
      <AddPaperView
        onAdd={mockOnAdd}
        searchByDOI={mockSearchByDOI}
        searchByQuery={mockSearchByQuery}
      />,
    );

    const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
    await userEvent.type(doiInput, "10.1234/test.doi");

    // Expect clear button to be present
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    await userEvent.click(clearButton);

    // Verify input is cleared and focused
    expect(doiInput).toHaveValue("");
    expect(doiInput).toHaveFocus();

    // Verify clear button is gone
    expect(
      screen.queryByRole("button", { name: /clear search/i }),
    ).not.toBeInTheDocument();
  });

  it("should show and work clear button in Keyword search", async () => {
    render(
      <AddPaperView
        onAdd={mockOnAdd}
        searchByDOI={mockSearchByDOI}
        searchByQuery={mockSearchByQuery}
      />,
    );

    const keywordTab = screen.getByText("Keyword Search");
    await userEvent.click(keywordTab);

    const searchInput = screen.getByPlaceholderText(
      /e.g., CRISPR gene editing/i,
    );
    await userEvent.type(searchInput, "quantum computing");

    // Expect clear button to be present
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    await userEvent.click(clearButton);

    // Verify input is cleared and focused
    expect(searchInput).toHaveValue("");
    expect(searchInput).toHaveFocus();

    // Verify clear button is gone
    expect(
      screen.queryByRole("button", { name: /clear search/i }),
    ).not.toBeInTheDocument();
  });
});
