import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualEntryTab } from "../../components/entities/AddPaperTabs/ManualEntryTab";
import { AddPaperView } from "../../components/entities/AddPaperView";
import { useAppStore } from "../../store/appStore";
import { TooltipProvider } from "../../components/ui/tooltip";

function renderTab(errors: any = {}) {
  return render(
    <ManualEntryTab
      manualTitle=""
      setManualTitle={vi.fn()}
      manualAuthors=""
      setManualAuthors={vi.fn()}
      manualDoi=""
      setManualDoi={vi.fn()}
      manualUrl=""
      setManualUrl={vi.fn()}
      onAdd={vi.fn()}
      loading={false}
      errors={errors}
      clearFieldError={vi.fn()}
    />,
  );
}

function renderView(overrides: {
  onAdd?: any;
  searchByDOI?: any;
  searchByQuery?: any;
} = {}) {
  const onAdd = overrides.onAdd ?? vi.fn().mockResolvedValue({ id: "p1" });
  return {
    onAdd,
    ...render(
      <TooltipProvider delayDuration={0}>
        <AddPaperView
          onAdd={onAdd}
          searchByDOI={overrides.searchByDOI ?? vi.fn()}
          searchByQuery={overrides.searchByQuery ?? vi.fn()}
        />
      </TooltipProvider>,
    ),
  };
}

async function goManual() {
  await userEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
}

async function fillTitle(title: string) {
  await userEvent.type(screen.getByPlaceholderText(/enter paper title/i), title);
}

describe("ManualEntryTab presentational", () => {
  it("enforces UI character bounds on every field", () => {
    renderTab();
    expect(screen.getByPlaceholderText(/enter paper title/i)).toHaveAttribute(
      "maxLength",
      "255",
    );
    expect(
      screen.getByPlaceholderText(/Doe, John; Smith, Jane/i),
    ).toHaveAttribute("maxLength", "255");
    expect(
      screen.getByPlaceholderText(/10\.1038\/nature12373/i),
    ).toHaveAttribute("maxLength", "500");
    expect(
      screen.getByPlaceholderText(/https:\/\/example\.com\/paper/i),
    ).toHaveAttribute("maxLength", "500");
  });

  it("renders aria-live character counters", () => {
    renderTab();
    const counters = screen.getAllByText(/^\d+\/(255|500)$/);
    expect(counters.length).toBeGreaterThanOrEqual(4);
    for (const counter of counters) {
      expect(counter).toHaveAttribute("aria-live", "polite");
    }
  });

  it("marks invalid fields with aria-invalid and describedby errors", () => {
    renderTab({ title: "Title is required", doi: "Bad DOI" });
    const title = screen.getByPlaceholderText(/enter paper title/i);
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title.getAttribute("aria-describedby")).toContain(
      "manual-title-error",
    );
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Bad DOI")).toBeInTheDocument();
  });
});

describe("Manual entry validation (AddPaperView)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ selectedPaper: null });
  });

  it("rejects junk DOIs and never calls onAdd", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("Junk DOI Paper");
    await userEvent.type(
      screen.getByPlaceholderText(/10\.1038\/nature12373/i),
      "not-a-doi",
    );
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Invalid DOI format. Expected e.g. 10.1038/nature12373.",
        ),
      ).toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("strips trailing punctuation from a pasted DOI", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("Trailing Punct Paper");
    await userEvent.type(
      screen.getByPlaceholderText(/10\.1038\/nature12373/i),
      "10.1234/abc.",
    );
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ doi: "10.1234/abc" }),
      );
    });
  });

  it("keeps DOI optional when empty", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("No DOI Paper");
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: "No DOI Paper" }),
      );
    });
    expect(onAdd.mock.calls[0][0]).not.toHaveProperty("doi");
  });

  it("keeps 'Doe, John' as a single author", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("Comma Author Paper");
    await userEvent.type(
      screen.getByPlaceholderText(/Doe, John; Smith, Jane/i),
      "Doe, John",
    );
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ authors: ["Doe, John"] }),
      );
    });
  });

  it("splits on semicolons, trims, collapses whitespace, and dedupes", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("Multi Author Paper");
    await userEvent.type(
      screen.getByPlaceholderText(/Doe, John; Smith, Jane/i),
      "Doe,  John ; Smith, Jane;Doe, John",
    );
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ authors: ["Doe, John", "Smith, Jane"] }),
      );
    });
  });

  it("blocks more than 50 authors with a submit error", async () => {
    const { onAdd } = renderView();
    await goManual();
    await fillTitle("Crowded Paper");
    const many = Array.from({ length: 51 }, (_, i) => `Author ${i + 1}`).join(
      "; ",
    );
    // fireEvent bypasses the input's UI maxLength so the >50 guard itself is
    // exercised (typed entry is already bounded by maxLength=255).
    fireEvent.change(
      screen.getByPlaceholderText(/Doe, John; Smith, Jane/i),
      { target: { value: many } },
    );
    await userEvent.click(screen.getByRole("button", { name: /add paper/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Too many authors (max 50)."),
      ).toBeInTheDocument();
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("clears a per-field error when that field changes", async () => {
    renderView();
    await goManual();
    // Trigger the title error, then type to clear it.
    fireEvent.submit(screen.getByRole("button", { name: /add paper/i }).closest("form")!);
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });
    await userEvent.type(
      screen.getByPlaceholderText(/enter paper title/i),
      "Now titled",
    );
    await waitFor(() => {
      expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
    });
  });
});
