import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";

describe("AddPaperView BibTeX Security", () => {
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

  it("should prevent importing a paper with a javascript: URL from BibTeX", async () => {
    const maliciousBibTeX = `
@misc{malicious,
  title = {Malicious Paper},
  url = {javascript:alert(1)},
  year = {2023}
}
    `;

    const file = new File([maliciousBibTeX], "malicious.bib", {
      type: "text/plain",
    });
    Object.defineProperty(file, "text", {
      value: async () => maliciousBibTeX,
    });

    render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        />
      </TooltipProvider>,
    );

    const importTab = screen.getByText("Import BibTeX");
    await userEvent.click(importTab);

    const fileInput = screen.getByLabelText(/Upload BibTeX File/i);
    await userEvent.upload(fileInput, file);

    // Wait for parsing
    await waitFor(() => {
      expect(screen.getByText("Malicious Paper")).toBeInTheDocument();
    });

    // Select and import
    // Note: Items are selected by default, so we don't need to click "Select All"
    const importButton = screen.getByRole("button", {
      name: /Import Selected/i,
    });
    await userEvent.click(importButton);

    // Verify onAdd was called
    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalled();
    });

    const calledArg = mockOnAdd.mock.calls[0][0];
    // Check if source_url is undefined (sanitized) or contains the malicious URL
    // If vulnerable, this will be "javascript:alert(1)"
    expect(calledArg.source_url).toBeUndefined();
  });
});
