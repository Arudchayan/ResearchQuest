import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePapers, normalizeDoi } from "../../hooks/usePapers";
import { mockSupabaseClient, mockPaper } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";
import { toast } from "sonner";
import type { Paper } from "../../types/database";

// Mock toast (warning included — ARU-657 dedupe uses it)
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock gamification utils
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(null),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

interface TableOptions {
  doiRows?: { doi: string }[];
  singleResult?: { data: unknown; error: unknown };
  listResult?: { data: unknown; error: unknown };
}

// Builds a routed mock for the two query paths in usePapers:
//  - dedupe check: from("papers").select("doi").eq(...).in(...) -> doiRows
//  - insert:       from("papers").insert(...).select().single() / .select()
function buildPapersMock({
  doiRows = [],
  singleResult = { data: null, error: null },
  listResult = { data: [], error: null },
}: TableOptions = {}) {
  const capturedInserts: unknown[] = [];

  const papersBuilder: any = {};
  papersBuilder.select = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.eq = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.in = vi.fn().mockResolvedValue({ data: doiRows, error: null });
  papersBuilder.inFail = vi.fn();
  papersBuilder.insert = vi.fn().mockImplementation((payload: unknown) => {
    capturedInserts.push(payload);
    return papersBuilder;
  });
  papersBuilder.single = vi.fn().mockResolvedValue(singleResult);
  papersBuilder.then = ((onFulfilled?: (value: any) => any) => {
    return Promise.resolve(listResult).then(onFulfilled);
  }) as any;

  const profileBuilder: any = {};
  profileBuilder.select = vi.fn().mockReturnValue(profileBuilder);
  profileBuilder.eq = vi.fn().mockReturnValue(profileBuilder);
  profileBuilder.single = vi.fn().mockResolvedValue({
    data: { auto_create_reading_tasks: false },
    error: null,
  });

  mockSupabaseClient.from.mockImplementation((tableName: string) => {
    if (tableName === "user_profiles") return profileBuilder;
    return papersBuilder;
  });

  return { capturedInserts, papersBuilder };
}

describe("normalizeDoi (ARU-657)", () => {
  it("lowercases and strips https resolver prefix", () => {
    expect(normalizeDoi("https://DOI.org/10.1234/AbC")).toBe("10.1234/abc");
  });

  it("strips http dx.doi.org prefix", () => {
    expect(normalizeDoi("http://dx.doi.org/10.9999/X.Y")).toBe(
      "10.9999/x.y",
    );
  });

  it("strips doi: scheme with whitespace", () => {
    expect(normalizeDoi("doi:  10.5555/plain")).toBe("10.5555/plain");
  });

  it("passes bare DOIs through (trimmed + lowercased)", () => {
    expect(normalizeDoi("  10.1111/Already.Bare ")).toBe(
      "10.1111/already.bare",
    );
  });
});

describe("usePapers server-side DOI dedupe (ARU-657)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [], papersLoading: false });
  });

  describe("createPaper (single)", () => {
    it("blocks a duplicate DOI (case-insensitive) and never inserts", async () => {
      const { capturedInserts } = buildPapersMock({
        doiRows: [{ doi: "10.1234/library-copy" }],
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPaper({
        title: "Duplicate Paper",
        authors: ["A"],
        doi: "10.1234/LIBRARY-COPY",
      } as any);

      expect(created).toBeNull();
      expect(capturedInserts).toHaveLength(0);
      expect(toast.warning).toHaveBeenCalledWith(
        "This paper (DOI) is already in your library",
      );
    });

    it("blocks a resolver-prefixed spelling of an existing DOI", async () => {
      const { capturedInserts } = buildPapersMock({
        doiRows: [{ doi: "10.1234/existing" }],
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPaper({
        title: "Same Paper Different Spelling",
        authors: [],
        doi: "https://doi.org/10.1234/existing",
      } as any);

      expect(created).toBeNull();
      expect(capturedInserts).toHaveLength(0);
    });

    it("inserts normally when the DOI is new", async () => {
      const newPaper = {
        ...mockPaper,
        id: "brand-new-id",
        doi: "10.7777/fresh",
      } as Paper;
      const { capturedInserts } = buildPapersMock({
        doiRows: [],
        singleResult: { data: newPaper, error: null },
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPaper({
        title: "Fresh Paper",
        authors: [],
        doi: "10.7777/FRESH",
      } as any);

      expect(created).toEqual(newPaper);
      expect(capturedInserts).toHaveLength(1);
      expect(toast.success).toHaveBeenCalledWith("Paper added successfully");
    });

    it("fails open when the duplicate check errors (creation still allowed)", async () => {
      const newPaper = {
        ...mockPaper,
        id: "fail-open-id",
        doi: "10.8888/check-fails",
      } as Paper;
      const { capturedInserts, papersBuilder } = buildPapersMock({
        singleResult: { data: newPaper, error: null },
      });
      papersBuilder.in = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "transient" } });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPaper({
        title: "Should Still Insert",
        authors: [],
        doi: "10.8888/check-fails",
      } as any);

      expect(created).toEqual(newPaper);
      expect(capturedInserts).toHaveLength(1);
    });
  });

  describe("createPapers (batch)", () => {
    it("drops library duplicates AND collapses in-batch DOI duplicates", async () => {
      const insertedPaper = {
        ...mockPaper,
        id: "kept-id",
        doi: "10.3333/batch",
      } as Paper;
      const { capturedInserts } = buildPapersMock({
        doiRows: [{ doi: "10.2222/lib-dup" }],
        listResult: { data: [insertedPaper], error: null },
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPapers([
        { title: "Lib Dup", authors: [], doi: "10.2222/LIB-DUP" },
        {
          title: "Batch Original",
          authors: [],
          doi: "10.3333/batch",
        },
        {
          title: "Batch Dup Spelling",
          authors: [],
          doi: "HTTPS://DOI.ORG/10.3333/batch",
        },
      ] as any);

      // Only the batch original survives: lib-dup blocked, spelling-collapsed
      expect(capturedInserts).toHaveLength(1);
      const payload = capturedInserts[0] as { doi?: string }[];
      expect(payload).toHaveLength(1);
      expect(payload[0].doi).toBe("10.3333/batch");
      expect(created).toEqual([insertedPaper]);
      expect(toast.warning).toHaveBeenCalledWith("2 duplicate papers skipped");
    });

    it("returns early with a warning when every entry is already in the library", async () => {
      const { capturedInserts } = buildPapersMock({
        doiRows: [{ doi: "10.4444/all-dup" }],
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPapers([
        { title: "All Dup", authors: [], doi: "10.4444/all-dup" },
      ] as any);

      expect(created).toEqual([]);
      expect(capturedInserts).toHaveLength(0);
      expect(toast.warning).toHaveBeenCalledWith(
        "All papers are already in your library",
      );
    });

    it("passes papers without DOIs through untouched", async () => {
      const keptA = { ...mockPaper, id: "a", doi: undefined } as Paper;
      const keptB = { ...mockPaper, id: "b", doi: undefined } as Paper;
      const { capturedInserts } = buildPapersMock({
        listResult: { data: [keptA, keptB], error: null },
      });

      const { result } = renderHook(() => usePapers("test-user-id"));
      const created = await result.current.createPapers([
        { title: "No DOI One", authors: [] },
        { title: "No DOI Two", authors: [] },
      ] as any);

      expect(capturedInserts).toHaveLength(1);
      expect(capturedInserts[0]).toHaveLength(2);
      expect(created).toEqual([keptA, keptB]);
    });
  });
});
