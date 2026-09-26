import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPaperView } from "../../components/entities/AddPaperView";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";
import { toast } from "sonner";
import { buildPaperPayload } from "../../utils/paperUtils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

// Force the warn-on-drop builder shape regardless of the paperUtils crew's
// current implementation; per-test overrides cover the plain shape too.
vi.mock("../../utils/paperUtils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../utils/paperUtils")>();
  return {
    ...actual,
    buildPaperPayload: vi.fn((paper: any) => ({
      draft: { title: paper.title, authors: paper.authors ?? [] },
      urlWarning: "Test source-link warning",
    })),
  };
});

const mockCrossrefPaper = {
  title: "Wrapper Paper",
  authors: ["Author One", "Author Two"],
  doi: "10.1234/wrapper",
};

function renderView(overrides: {
  onAdd?: any;
  searchByDOI?: any;
  searchByQuery?: any;
} = {}) {
  const onAdd = overrides.onAdd ?? vi.fn().mockResolvedValue({ id: "p1" });
  const searchByDOI = overrides.searchByDOI ?? vi.fn();
  const searchByQuery = overrides.searchByQuery ?? vi.fn();
  render(
    <TooltipProvider delayDuration={0}>
      <AddPaperView
        onAdd={onAdd}
        searchByDOI={searchByDOI}
        searchByQuery={searchByQuery}
      />
    </TooltipProvider>,
  );
  return { onAdd, searchByDOI, searchByQuery };
}

describe("AddPaperView builder warn-on-drop shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ selectedPaper: null });
  });

  it("unwraps {draft, urlWarning} and warns after a successful add", async () => {
    const { onAdd, searchByDOI } = renderView({
      searchByDOI: vi.fn().mockResolvedValue(mockCrossrefPaper),
    });

    await userEvent.type(
      screen.getByPlaceholderText(/e.g., 10.1038/i),
      "10.1234/wrapper",
    );
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add paper to library/i }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /add paper to library/i }),
    );

    await waitFor(() => {
      // onAdd receives the bare draft, never the wrapper.
      expect(onAdd).toHaveBeenCalledWith({
        title: "Wrapper Paper",
        authors: ["Author One", "Author Two"],
      });
    });
    expect(toast.warning).toHaveBeenCalledWith("Test source-link warning");
  });

  it("stays compatible with the plain-draft builder shape (no warning)", async () => {
    vi.mocked(buildPaperPayload).mockReturnValueOnce({
      title: "Plain Paper",
      authors: [],
    } as any);
    const { onAdd, searchByDOI } = renderView({
      searchByDOI: vi.fn().mockResolvedValue({
        title: "Plain Paper",
        authors: [],
      }),
    });

    await userEvent.type(
      screen.getByPlaceholderText(/e.g., 10.1038/i),
      "10.1234/plain",
    );
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add paper to library/i }),
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /add paper to library/i }),
    );

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Plain Paper" }),
      );
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("AddPaperView tab-reset parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ selectedPaper: null });
  });

  it("clicking a tab clears search errors, results, and keeps text inputs", async () => {
    const { searchByDOI } = renderView({
      searchByDOI: vi.fn().mockResolvedValue(mockCrossrefPaper),
    });

    const doiInput = screen.getByPlaceholderText(/e.g., 10.1038/i);
    await userEvent.type(doiInput, "10.1234/wrapper");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add paper to library/i }),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
    await userEvent.click(screen.getByRole("tab", { name: "DOI Search" }));

    // Result cleared, typed DOI kept.
    expect(
      screen.queryByRole("button", { name: /add paper to library/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., 10.1038/i)).toHaveValue(
      "10.1234/wrapper",
    );
    expect(searchByDOI).toHaveBeenCalledTimes(1);
  });

  it("keyboard tab switch clears errors exactly like a click", async () => {
    renderView({ searchByDOI: vi.fn().mockResolvedValue(null) });

    await userEvent.type(
      screen.getByPlaceholderText(/e.g., 10.1038/i),
      "10.1234/missing",
    );
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText(/paper not found/i)).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.queryByText(/paper not found/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Keyword Search" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keyboard tab switch also clears manual field errors", async () => {
    renderView();
    await userEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
    const form = screen
      .getByRole("button", { name: /^add paper$/i })
      .closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });

    await waitFor(() => {
      expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
    });
  });
});

describe("AddPaperView disabled-search hints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ selectedPaper: null });
  });

  it("DOI search explains the disabled button via title + live hint", async () => {
    renderView();
    const searchButton = screen.getByRole("button", { name: /^search$/i });
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute(
      "title",
      "Enter a DOI to enable Search.",
    );
    expect(
      screen.getByText("Enter a DOI to enable Search."),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText(/e.g., 10.1038/i),
      "10.1234/x",
    );
    expect(
      screen.queryByText("Enter a DOI to enable Search."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^search$/i }),
    ).not.toHaveAttribute("title");
  });

  it("keyword search explains the disabled button via title + live hint", async () => {
    renderView();
    await userEvent.click(screen.getByRole("tab", { name: "Keyword Search" }));
    const searchButton = screen.getByRole("button", { name: /^search$/i });
    expect(searchButton).toBeDisabled();
    expect(searchButton).toHaveAttribute(
      "title",
      "Enter keywords to enable Search.",
    );
    expect(
      screen.getByText("Enter keywords to enable Search."),
    ).toBeInTheDocument();
  });
});
