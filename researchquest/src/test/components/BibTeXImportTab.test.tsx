import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BibTeXImportTab } from "../../components/entities/AddPaperTabs/BibTeXImportTab";
import type { BibTeXEntry } from "../../utils/bibtexParser";

const entries: BibTeXEntry[] = [
  { id: "t1", type: "article", title: "Titled Paper", authors: ["Smith, J."] },
  { id: "u1", type: "article", authors: ["Doe, J."] },
];

function renderTab(overrides: Partial<Parameters<typeof BibTeXImportTab>[0]> = {}) {
  return render(
    <BibTeXImportTab
      onFileSelect={vi.fn()}
      onImport={vi.fn().mockResolvedValue(undefined)}
      loading={false}
      error=""
      parsedEntries={entries}
      selectedEntryIds={new Set(["t1"])}
      toggleEntrySelection={vi.fn()}
      importProgress={null}
      {...overrides}
    />
  );
}

describe("BibTeXImportTab", () => {
  it("renders a Missing title badge for untitled entries", () => {
    renderTab();
    expect(screen.getByText("Missing title")).toBeInTheDocument();
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("disables selection for untitled entries (id-based, no opt-in to junk)", async () => {
    const toggle = vi.fn();
    const { container } = renderTab({ toggleEntrySelection: toggle });
    const untitledBox = container.querySelector("#bibtex-entry-u1") as HTMLInputElement;
    expect(untitledBox).not.toBeNull();
    expect(untitledBox.disabled).toBe(true);
    await userEvent.click(untitledBox);
    expect(toggle).not.toHaveBeenCalled();
  });

  it("renders a role=status stats banner when importStats is present", () => {
    renderTab({ importStats: { success: 1, failed: 1 } });
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/1 of 2/);
  });

  it("renders no stats banner when importStats is absent", () => {
    renderTab({ importStats: null });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders a role=status parse-warnings note for renamed duplicate keys", () => {
    renderTab({ parseWarnings: { duplicateKeys: ["dup"], stringYears: [] } });
    const note = screen.getByRole("status");
    expect(note.textContent).toMatch(/duplicate entry key\(s\) renamed/);
    expect(note.textContent).toMatch(/dup/);
  });

  it("renders no warnings note when warning lists are empty", () => {
    renderTab({ parseWarnings: { duplicateKeys: [], stringYears: [] } });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
