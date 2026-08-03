import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import type { CrossrefPaper } from "../../types/database";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";

const TAB_NAMES = {
  doi: /doi search/i,
  search: /keyword search/i,
  import: /import bibtex/i,
  manual: /manual entry/i,
} as const;

describe("AddPaperView Component", () => {
  const mockOnAdd = vi.fn();
  const mockSearchByDOI = vi.fn();
  const mockSearchByQuery = vi.fn();
  const reloadSpy = vi.fn();
  const originalLocation = window.location;

  const mockCrossrefPaper: CrossrefPaper = {
    title: "Test Paper from CrossRef",
    authors: ["Author One", "Author Two"],
    doi: "10.1234/test.doi",
    sourceUrl: "https://example.com/paper",
    abstract: "This is a test abstract",
    publicationDate: "2024",
  };

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
    mockOnAdd.mockResolvedValue({ id: "new-paper-id", ...mockCrossrefPaper });
    useAppStore.setState({ selectedPaper: null });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("Tab Navigation", () => {
    it("should render all tabs", () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      expect(screen.getByRole("tab", { name: TAB_NAMES.doi })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: TAB_NAMES.search })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: TAB_NAMES.import })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: TAB_NAMES.manual })).toBeInTheDocument();
    });

    it("should switch between tabs", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      await userEvent.click(keywordTab);

      expect(
        screen.getByPlaceholderText(/e.g., CRISPR gene editing/i),
      ).toBeInTheDocument();

      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });
      await userEvent.click(manualTab);

      expect(
        screen.getByPlaceholderText(/Enter paper title/i),
      ).toBeInTheDocument();
    });

    it("supports roving keyboard navigation between tabs", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiTab = screen.getByRole("tab", { name: TAB_NAMES.doi });
      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      const importTab = screen.getByRole("tab", { name: TAB_NAMES.import });
      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });

      expect(doiTab).toHaveAttribute("tabindex", "0");
      expect(keywordTab).toHaveAttribute("tabindex", "-1");

      doiTab.focus();
      await userEvent.keyboard("{ArrowRight}");

      expect(keywordTab).toHaveFocus();
      expect(keywordTab).toHaveAttribute("tabindex", "0");
      expect(screen.getByPlaceholderText(/e.g., CRISPR gene editing/i)).toBeInTheDocument();

      await userEvent.keyboard("{End}");
      expect(manualTab).toHaveFocus();
      expect(manualTab).toHaveAttribute("tabindex", "0");
      expect(screen.getByPlaceholderText(/Enter paper title/i)).toBeInTheDocument();

      await userEvent.keyboard("{Home}");
      expect(doiTab).toHaveFocus();
      expect(doiTab).toHaveAttribute("tabindex", "0");
      expect(importTab).toHaveAttribute("tabindex", "-1");
    });

    it("should clear errors when switching tabs", async () => {
      mockSearchByDOI.mockResolvedValue(null);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      // Trigger an error in DOI tab
      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/notfound");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/paper not found/i)).toBeInTheDocument();
      });

      // Switch tabs - error should clear
      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      await userEvent.click(keywordTab);

      await waitFor(() => {
        expect(screen.queryByText(/paper not found/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("DOI Search", () => {
    it("should search paper by DOI", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchByDOI).toHaveBeenCalledWith("10.1234/test.doi");
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument();
      });
    });

    it("should handle Enter key for DOI search", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi{Enter}");

      await waitFor(() => {
        expect(mockSearchByDOI).toHaveBeenCalledWith("10.1234/test.doi");
      });
    });

    it("should add paper from DOI search result", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await act(async () => {
        await userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", {
        name: /add paper to library/i,
      });
      await userEvent.click(addButton);

      // Workaround: JSDOM sometimes doesn't fire form onSubmit when button clicked
      // if there is an issue with required validation or event bubbling, so we explicitly dispatch it if needed, or simply wait for the required validation to kick in.

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: mockCrossrefPaper.title,
          authors: mockCrossrefPaper.authors,
          doi: mockCrossrefPaper.doi,
          source_url: mockCrossrefPaper.sourceUrl,
          abstract: mockCrossrefPaper.abstract,
          publication_date: "2024-01-01",
        });
      });
    });

    it("should show success message after adding paper", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await act(async () => {
        await userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(screen.getByText(mockCrossrefPaper.title)).toBeInTheDocument();
      });

      const addButton = screen.getByRole("button", {
        name: /add paper to library/i,
      });
      await act(async () => {
        await userEvent.click(addButton);

      // Workaround: JSDOM sometimes doesn't fire form onSubmit when button clicked
      // if there is an issue with required validation or event bubbling, so we explicitly dispatch it if needed, or simply wait for the required validation to kick in.
      });

      await waitFor(() => {
        expect(screen.getAllByText(/paper added successfully/i)[0]).toBeInTheDocument();
      });
    });

    it("should handle DOI search errors", async () => {
      mockSearchByDOI.mockResolvedValue(null);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/notfound");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/paper not found/i)).toBeInTheDocument();
      });
    });
  });

  describe("Keyword Search", () => {
    it("should search papers by keywords", async () => {
      const mockResults = [mockCrossrefPaper];
      mockSearchByQuery.mockResolvedValue(mockResults);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      await userEvent.click(keywordTab);

      const searchInput = screen.getByPlaceholderText(
        /e.g., CRISPR gene editing/i,
      );
      await userEvent.type(searchInput, "quantum computing");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(mockSearchByQuery).toHaveBeenCalledWith("quantum computing", {
          rows: 10,
          sort: "score",
          order: "desc",
        });
        expect(screen.getAllByText(mockCrossrefPaper.title)).not.toHaveLength(
          0,
        );
        expect(
          screen.getByRole("button", { name: /add to library/i }),
        ).toBeInTheDocument();
        expect(screen.getByText(/view original source/i)).toBeInTheDocument();
        expect(
          screen.getByText(mockCrossrefPaper.abstract!),
        ).toBeInTheDocument();
      });
    });

    it("should add paper from keyword search results", async () => {
      const mockResults = [mockCrossrefPaper];
      mockSearchByQuery.mockResolvedValue(mockResults);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      await userEvent.click(keywordTab);

      const searchInput = screen.getByPlaceholderText(
        /e.g., CRISPR gene editing/i,
      );
      await userEvent.type(searchInput, "quantum computing");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getAllByText(mockCrossrefPaper.title)).not.toHaveLength(
          0,
        );
      });

      const addToLibrary = screen.getByRole("button", {
        name: /add to library/i,
      });
      await userEvent.click(addToLibrary);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: mockCrossrefPaper.title,
          authors: mockCrossrefPaper.authors,
          doi: mockCrossrefPaper.doi,
          source_url: mockCrossrefPaper.sourceUrl,
          abstract: mockCrossrefPaper.abstract,
          publication_date: "2024-01-01",
        });
      });
    });

    it("should handle empty search results", async () => {
      mockSearchByQuery.mockResolvedValue([]);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const keywordTab = screen.getByRole("tab", { name: TAB_NAMES.search });
      await userEvent.click(keywordTab);

      const searchInput = screen.getByPlaceholderText(
        /e.g., CRISPR gene editing/i,
      );
      await userEvent.type(searchInput, "nonexistent query");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/no papers found/i)).toBeInTheDocument();
      });
    });
  });

  describe("Manual Entry", () => {
    it("should add paper via manual entry", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });
      await userEvent.click(manualTab);

      const titleInput = screen.getByPlaceholderText(/enter paper title/i);
      await userEvent.type(titleInput, "Manual Test Paper");

      const authorsInput = screen.getByPlaceholderText(/John Doe, Jane Smith/i);
      await userEvent.type(authorsInput, "Author One, Author Two");

      const addButton = screen.getByRole("button", { name: /add paper/i });
      await userEvent.click(addButton);

      // Workaround: JSDOM sometimes doesn't fire form onSubmit when button clicked
      // if there is an issue with required validation or event bubbling, so we explicitly dispatch it if needed, or simply wait for the required validation to kick in.

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: "Manual Test Paper",
          authors: ["Author One", "Author Two"],
        });
      });
    });

    it("should require title for manual entry", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });
      await userEvent.click(manualTab);

      const addButton = screen.getByRole("button", { name: /add paper/i });
      expect(addButton).toBeEnabled();

      // In JSDOM, clicking a submit button on a form with a required input that is empty
      // does not trigger the onSubmit event, but it also does not natively display the built-in HTML5 validation message
      // in a way that RTL can easily catch as text content.
      // To simulate the component's internal validation, we manually fire the submit event.
      fireEvent.submit(addButton.closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByPlaceholderText(/enter paper title/i);
      expect(titleInput).toHaveFocus();

      await userEvent.type(titleInput, "A");

      await waitFor(() => {
        expect(
          screen.queryByText(/Title is required/i),
        ).not.toBeInTheDocument();
      });
    });

    it("should handle optional fields in manual entry", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });
      await userEvent.click(manualTab);

      const titleInput = screen.getByPlaceholderText(/enter paper title/i);
      await userEvent.type(titleInput, "Manual Test Paper");

      const doiInput = screen.getByPlaceholderText("10.1038/nature12373");
      await userEvent.type(doiInput, "10.1234/manual.doi");

      const urlInput = screen.getByPlaceholderText("https://...");
      await userEvent.type(urlInput, "https://example.com/manual");

      const addButton = screen.getByRole("button", { name: /add paper/i });
      await userEvent.click(addButton);

      // Workaround: JSDOM sometimes doesn't fire form onSubmit when button clicked
      // if there is an issue with required validation or event bubbling, so we explicitly dispatch it if needed, or simply wait for the required validation to kick in.

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          title: "Manual Test Paper",
          authors: [],
          doi: "10.1234/manual.doi",
          source_url: "https://example.com/manual",
        });
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading indicator during DOI search", async () => {
      let resolveSearch: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      mockSearchByDOI.mockReturnValue(searchPromise);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      // Should show loading spinner
      expect(searchButton).toBeDisabled();

      resolveSearch!(mockCrossrefPaper);

      await waitFor(() => {
        expect(searchButton).not.toBeDisabled();
      });
    });

    it("should disable search button when input is empty", () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      expect(searchButton).toBeDisabled();
    });

    it('should show loading state on "Add Paper" button during manual entry submission', async () => {
      // Create a promise that we can control resolution of
      let resolveAdd: (value: any) => void;
      const addPromise = new Promise((resolve) => {
        resolveAdd = resolve;
      });
      mockOnAdd.mockReturnValue(addPromise);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      // Switch to Manual Entry
      const manualTab = screen.getByRole("tab", { name: TAB_NAMES.manual });
      await userEvent.click(manualTab);

      // Fill form
      const titleInput = screen.getByPlaceholderText(/enter paper title/i);
      await userEvent.type(titleInput, "Loading Test Paper");

      // Click Add
      const addButton = screen.getByRole("button", { name: /add paper/i });
      await userEvent.click(addButton);

      // Workaround: JSDOM sometimes doesn't fire form onSubmit when button clicked
      // if there is an issue with required validation or event bubbling, so we explicitly dispatch it if needed, or simply wait for the required validation to kick in.

      // Verify loading state
      expect(addButton).toBeDisabled();
      expect(screen.getByText("Adding Paper...")).toBeInTheDocument();

      // Resolve the promise
      await act(async () => {
        resolveAdd({ id: "new-id", title: "Loading Test Paper" });
      });

      // Verify loading state cleared
      await waitFor(() => {
        expect(screen.queryByText("Adding Paper...")).not.toBeInTheDocument();
        expect(screen.getAllByText(/paper added successfully/i)[0]).toBeInTheDocument();
      });
    });
  });

  describe("Paper Metadata Display", () => {
    it("should display paper abstract when available", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(
          screen.getByText(mockCrossrefPaper.abstract!),
        ).toBeInTheDocument();
      });
    });

    it("should display multiple authors correctly", async () => {
      mockSearchByDOI.mockResolvedValue(mockCrossrefPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/Author One, Author Two/)).toBeInTheDocument();
      });
    });

    it('should show "et al." for papers with many authors', async () => {
      const manyAuthorsPaper = {
        ...mockCrossrefPaper,
        authors: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      };
      mockSearchByDOI.mockResolvedValue(manyAuthorsPaper);

      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
      await userEvent.type(doiInput, "10.1234/test.doi");

      const searchButton = screen.getByRole("button", { name: /^search$/i });
      await userEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText(/et al\./)).toBeInTheDocument();
      });
    });
  });

  describe("Import BibTeX", () => {
    it("should switch to Import tab", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      const importTab = screen.getByRole("tab", { name: TAB_NAMES.import });
      await userEvent.click(importTab);

      expect(screen.getByText(/upload bibtex file/i)).toBeInTheDocument();
    });

    it("should handle file upload and parsing", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      await userEvent.click(screen.getByRole("tab", { name: TAB_NAMES.import }));

      const fileContent = `
@article{key1,
  title = {Test Paper},
  author = {Test Author},
  year = {2023}
}
      `;
      const file = new File([fileContent], "test.bib", { type: "text/plain" });
      Object.defineProperty(file, "text", {
        value: async () => fileContent,
      });

      const input = screen.getByLabelText(/upload bibtex file/i);
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("Test Paper")).toBeInTheDocument();
        expect(screen.getByText("Test Author")).toBeInTheDocument();
      });

      expect(screen.getByText(/1 papers selected/i)).toBeInTheDocument();
    });

    it("should import selected papers", async () => {
      render(
        <TooltipProvider delayDuration={0}><AddPaperView
          onAdd={mockOnAdd}
          searchByDOI={mockSearchByDOI}
          searchByQuery={mockSearchByQuery}
        /></TooltipProvider>,
      );

      await userEvent.click(screen.getByRole("tab", { name: TAB_NAMES.import }));

      const fileContent = `
@article{key1,
  title = {Test Paper},
  author = {Test Author},
  year = {2023}
}
      `;
      const file = new File([fileContent], "test.bib", { type: "text/plain" });
      Object.defineProperty(file, "text", {
        value: async () => fileContent,
      });

      const input = screen.getByLabelText(/upload bibtex file/i);
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("Test Paper")).toBeInTheDocument();
      });

      const importBtn = screen.getByRole("button", {
        name: /import selected/i,
      });
      await userEvent.click(importBtn);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Test Paper",
            authors: ["Test Author"],
          }),
        );
        expect(screen.getAllByText(/successfully imported 1 papers/i)[0]).toBeInTheDocument();
      });
    });
  });
});
