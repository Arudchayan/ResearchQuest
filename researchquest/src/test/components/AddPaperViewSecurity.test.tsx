import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import type { CrossrefPaper } from "../../types/database";
import { useAppStore } from "../../store/appStore";

const TAB_NAMES = {
  import: /import bibtex/i,
  manual: /manual entry/i,
} as const;

describe("AddPaperView Security", () => {
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
    mockOnAdd.mockResolvedValue({
      id: "new-paper-id",
      title: "Test Paper",
      authors: [],
    });
    useAppStore.setState({ selectedPaper: null });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("should prevent adding a paper with a javascript: URL in manual entry", async () => {
    render(
      <AddPaperView
        onAdd={mockOnAdd}
        searchByDOI={mockSearchByDOI}
        searchByQuery={mockSearchByQuery}
      />,
    );

    const manualTab = screen.getByRole("button", { name: TAB_NAMES.manual });
    await userEvent.click(manualTab);

    const titleInput = screen.getByPlaceholderText(/enter paper title/i);
    await userEvent.type(titleInput, "Malicious Paper");

    const urlInput = screen.getByPlaceholderText("https://...");
    await userEvent.type(urlInput, "javascript:alert(1)");

    const addButton = screen.getByRole("button", { name: /add paper/i });
    await userEvent.click(addButton);

    // We expect it NOT to be called and an error to be shown.
    await waitFor(() => {
      expect(screen.getByText(/Invalid URL protocol/i)).toBeInTheDocument();
      expect(mockOnAdd).not.toHaveBeenCalled();
    });
  });

  it("should prevent uploading a file larger than 5MB", async () => {
    render(
      <AddPaperView
        onAdd={mockOnAdd}
        searchByDOI={mockSearchByDOI}
        searchByQuery={mockSearchByQuery}
      />,
    );

    const importTab = screen.getByRole("button", { name: TAB_NAMES.import });
    await userEvent.click(importTab);

    const fileInput = screen.getByLabelText(/upload bibtex file/i);

    // Create a mock large file
    const largeFile = new File(["a"], "large.bib", { type: "text/plain" });
    // Mock the size property to be > 5MB (5 * 1024 * 1024 + 1)
    Object.defineProperty(largeFile, "size", {
      get: () => 5 * 1024 * 1024 + 1,
      configurable: true,
    });

    await userEvent.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds the limit of 5MB\./i)).toBeInTheDocument();
    });
  });
});
