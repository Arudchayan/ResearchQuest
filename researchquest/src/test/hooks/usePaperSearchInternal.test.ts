import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePaperSearch } from "../../hooks/usePaperSearchInternal";
import type { CrossrefPaper } from "../../types/database";

const mockPaper = {
  title: "Found Paper",
  authors: ["A"],
  doi: "10.1234/found",
} as CrossrefPaper;

function setup(searchByDOI: (doi: string) => Promise<CrossrefPaper | null>) {
  return renderHook(() =>
    usePaperSearch({
      searchByDOI,
      searchByQuery: vi.fn().mockResolvedValue([]),
    }),
  );
}

describe("usePaperSearchInternal DOI fallback + error passthrough", () => {
  it("sets the not-found fallback when the result is null and no error is set", async () => {
    const { result } = setup(vi.fn().mockResolvedValue(null));

    await act(async () => {
      await result.current.performDOISearch("10.1234/missing");
    });

    expect(result.current.doiResult).toBeNull();
    expect(result.current.error).toBe(
      "Paper not found. Try manual entry or search by keywords.",
    );
  });

  it("keeps a hook error set mid-flight instead of overwriting it with the fallback", async () => {
    let resolveSearch: ((value: CrossrefPaper | null) => void) | null = null;
    const searchByDOI = vi.fn(
      () =>
        new Promise<CrossrefPaper | null>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const { result } = setup(searchByDOI);

    let pending: Promise<void>;
    act(() => {
      pending = result.current.performDOISearch("10.1234/slow");
    });
    // An external failure lands while the lookup is still pending.
    act(() => {
      result.current.setError("External failure");
    });
    await act(async () => {
      resolveSearch!(null);
      await pending!;
    });

    expect(result.current.error).toBe("External failure");
  });

  it("passes a thrown error message through verbatim", async () => {
    const { result } = setup(
      vi.fn().mockRejectedValue(new Error("Crossref is down")),
    );

    await act(async () => {
      await result.current.performDOISearch("10.1234/boom");
    });

    expect(result.current.error).toBe("Crossref is down");
  });

  it("falls back to the generic message only when the thrown error has none", async () => {
    const { result } = setup(vi.fn().mockRejectedValue("mystery"));

    await act(async () => {
      await result.current.performDOISearch("10.1234/boom");
    });

    expect(result.current.error).toBe("Search failed. Please try again.");
  });

  it("sets no error when a result is found", async () => {
    const { result } = setup(vi.fn().mockResolvedValue(mockPaper));

    await act(async () => {
      await result.current.performDOISearch("10.1234/found");
    });

    expect(result.current.doiResult).toEqual(mockPaper);
    expect(result.current.error).toBe("");
  });
});
