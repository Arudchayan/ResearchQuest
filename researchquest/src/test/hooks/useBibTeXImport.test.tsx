import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBibTeXImport } from "../../hooks/useBibTeXImport";

function makeFile(name: string, type: string, content: string): File {
  const file = new File([content], name, { type });
  Object.defineProperty(file, "text", { value: async () => content });
  return file;
}

const TWO_TITLED = `
@article{a1, title = {First}, year = {2020}}
@article{a2, title = {Second}, year = {2021}}
`;

const WITH_UNTITLED = `
@article{t1, title = {Titled Paper}, year = {2020}}
@article{u1, year = {2021}}
`;

describe("useBibTeXImport file gate (OR-accept)", () => {
  it("accepts a valid .bib name with empty file.type (Windows)", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("papers.bib", "", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    expect(result.current.error).not.toBe("Please upload a .bib file.");
    expect(result.current.parsedEntries).toHaveLength(2);
  });

  it("accepts bibtex MIME type without .bib extension", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("papers.txt", "application/x-bibtex", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    expect(result.current.parsedEntries).toHaveLength(2);
  });

  it("rejects non-.bib name with non-bibtex type", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("notes.txt", "text/plain", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    expect(result.current.error).toBe("Please upload a .bib file.");
    expect(result.current.parsedEntries).toHaveLength(0);
  });
});

describe("useBibTeXImport Untitled exclusion", () => {
  it("excludes untitled entries from default selection and from import", async () => {
    const onAddBatch = vi.fn().mockResolvedValue([{ id: "p1" }]);
    const onAdd = vi.fn().mockResolvedValue({ id: "p1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd, onAddBatch));
    const file = makeFile("papers.bib", "", WITH_UNTITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    expect(result.current.parsedEntries).toHaveLength(2);
    // Untitled excluded from default selection.
    expect([...result.current.selectedEntryIds]).toEqual(["t1"]);

    await act(async () => {
      await result.current.handleImport();
    });
    // Only the titled payload is sent — no silent "Untitled" persist.
    expect(onAddBatch).toHaveBeenCalledTimes(1);
    const payload = onAddBatch.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].title).toBe("Titled Paper");
  });
});

describe("useBibTeXImport retain-on-partial", () => {
  it("clears list on full success, retains + errors on partial (batch)", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "x" });
    // Batch reports only 1 of 2 added => partial failure.
    const onAddBatch = vi.fn().mockResolvedValue([{ id: "p1" }]);
    const { result } = renderHook(() => useBibTeXImport(onAdd, onAddBatch));
    const file = makeFile("papers.bib", "", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(result.current.importStats).toEqual({ success: 1, failed: 1 });
    // Retained (not cleared) on partial.
    expect(result.current.parsedEntries).toHaveLength(2);
    expect(result.current.error).toBe(
      "Imported 1 of 2; 1 failed \u2014 failed entries kept in the list."
    );
  });

  it("retains + errors on partial (single-add path)", async () => {
    const onAdd = vi
      .fn()
      .mockResolvedValueOnce({ id: "p1" })
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("papers.bib", "", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(result.current.importStats).toEqual({ success: 1, failed: 1 });
    expect(result.current.parsedEntries).toHaveLength(2);
    expect(result.current.error).toBe(
      "Imported 1 of 2; 1 failed \u2014 failed entries kept selected."
    );
  });

  it("clears list only when failedCount === 0", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "p" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("papers.bib", "", TWO_TITLED);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(result.current.importStats).toEqual({ success: 2, failed: 0 });
    expect(result.current.parsedEntries).toHaveLength(0);
    expect(result.current.selectedEntryIds.size).toBe(0);
  });
});

const WITH_DUPES = `
@article{dup, title = {First}, year = {2020}}
@article{dup, title = {Second}, year = {2021}}
`;

describe("useBibTeXImport parse warnings", () => {
  it("exposes duplicateKeys warnings and keeps suffixed entries", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    const file = makeFile("papers.bib", "", WITH_DUPES);
    await act(async () => {
      await result.current.handleFileChange(file);
    });
    expect(result.current.parsedEntries.map((e) => e.id)).toEqual(["dup", "dup-2"]);
    expect(result.current.parseWarnings?.duplicateKeys).toEqual(["dup"]);
  });

  it("clears warnings on new file", async () => {
    const onAdd = vi.fn().mockResolvedValue({ id: "1" });
    const { result } = renderHook(() => useBibTeXImport(onAdd));
    await act(async () => {
      await result.current.handleFileChange(makeFile("a.bib", "", WITH_DUPES));
    });
    expect(result.current.parseWarnings).not.toBeNull();
    await act(async () => {
      await result.current.handleFileChange(makeFile("b.bib", "", TWO_TITLED));
    });
    expect(result.current.parseWarnings).toBeNull();
  });
});
