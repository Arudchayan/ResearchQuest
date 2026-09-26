import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePapers,
  DOI_PATTERN,
  sanitizeDoiInput,
  PAPER_SOURCE_URL_WARNING_SINGLE,
  PAPER_SOURCE_URL_WARNING_EDIT,
} from "../../hooks/usePapers";
import { mockSupabaseClient, mockPaper } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";
import { toast } from "sonner";
import type { Paper } from "../../types/database";

// Mock toast (warning included — warn-on-drop paths use it)
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
  awardXP: vi.fn().mockResolvedValue(true),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

interface PapersMockOptions {
  doiRows?: { doi: string }[];
  singleResult?: { data: unknown; error: unknown };
  listResult?: { data: unknown; error: unknown };
}

function buildPapersMock({
  doiRows = [],
  singleResult = { data: null, error: null },
  listResult = { data: [], error: null },
}: PapersMockOptions = {}) {
  const capturedInserts: unknown[] = [];
  const capturedUpdates: unknown[] = [];

  const papersBuilder: any = {};
  papersBuilder.select = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.eq = vi.fn().mockReturnValue(papersBuilder);
  papersBuilder.in = vi.fn().mockResolvedValue({ data: doiRows, error: null });
  papersBuilder.insert = vi.fn().mockImplementation((payload: unknown) => {
    capturedInserts.push(payload);
    return papersBuilder;
  });
  papersBuilder.update = vi.fn().mockImplementation((payload: unknown) => {
    capturedUpdates.push(payload);
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

  const tasksBuilder: any = {};
  tasksBuilder.insert = vi.fn().mockReturnValue(tasksBuilder);
  tasksBuilder.then = ((onFulfilled?: (value: any) => any) => {
    return Promise.resolve({ data: null, error: null }).then(onFulfilled);
  }) as any;

  mockSupabaseClient.from.mockImplementation((tableName: string) => {
    if (tableName === "user_profiles") return profileBuilder;
    if (tableName === "tasks") return tasksBuilder;
    return papersBuilder;
  });

  return { capturedInserts, capturedUpdates };
}

describe("DOI_PATTERN + sanitizeDoiInput", () => {
  it("accepts canonical DOIs", () => {
    expect(DOI_PATTERN.test("10.1038/nature12373")).toBe(true);
    expect(DOI_PATTERN.test("10.1234/abc")).toBe(true);
  });

  it("rejects junk that is not a DOI", () => {
    expect(DOI_PATTERN.test("not-a-doi")).toBe(false);
    expect(DOI_PATTERN.test("10.12/short-registrant")).toBe(false);
    expect(DOI_PATTERN.test("")).toBe(false);
  });

  it("strips trailing pasted punctuation before matching", () => {
    expect(sanitizeDoiInput("10.1234/abc.")).toBe("10.1234/abc");
    expect(sanitizeDoiInput("10.1234/abc),")).toBe("10.1234/abc");
    expect(DOI_PATTERN.test(sanitizeDoiInput("10.1234/abc."))).toBe(true);
  });

  it("normalizes resolver prefixes and casing", () => {
    expect(sanitizeDoiInput("https://doi.org/10.1234/ABC")).toBe(
      "10.1234/abc",
    );
  });
});

describe("usePapers source_url preserve+warn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [], papersLoading: false });
  });

  it("create drops an unsafe URL, still creates, warns once after success", async () => {
    const created = { ...mockPaper, id: "warned-id" } as Paper;
    const { capturedInserts } = buildPapersMock({
      singleResult: { data: created, error: null },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let paper: Paper | null = null;
    await act(async () => {
      paper = await result.current.createPaper({
        title: "Unsafe Link Paper",
        authors: ["A"],
        source_url: "javascript:alert(1)",
      } as any);
    });

    expect(paper).toEqual(created);
    expect(capturedInserts).toHaveLength(1);
    expect(
      (capturedInserts[0] as Record<string, unknown>).source_url,
    ).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith("Paper added successfully");
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      PAPER_SOURCE_URL_WARNING_SINGLE,
    );
    // Success fires before the warning.
    const successOrder = (toast.success as any).mock.invocationCallOrder[0];
    const warningOrder = (toast.warning as any).mock.invocationCallOrder[0];
    expect(successOrder).toBeLessThan(warningOrder);
  });

  it("create with a DB error never warns about the dropped URL", async () => {
    buildPapersMock({
      singleResult: { data: null, error: { message: "db down" } },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let paper: Paper | null = null;
    await act(async () => {
      paper = await result.current.createPaper({
        title: "Doomed Paper",
        authors: ["A"],
        source_url: "javascript:alert(1)",
      } as any);
    });

    expect(paper).toBeNull();
    expect(toast.error).toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("rejects an invalid DOI instead of silently keeping it", async () => {
    const { capturedInserts } = buildPapersMock();

    const { result } = renderHook(() => usePapers("test-user-id"));
    let paper: Paper | null = null;
    await act(async () => {
      paper = await result.current.createPaper({
        title: "Junk DOI Paper",
        authors: ["A"],
        doi: "not-a-doi",
      } as any);
    });

    expect(paper).toBeNull();
    expect(capturedInserts).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(
      "Invalid DOI format. Expected e.g. 10.1038/nature12373.",
    );
  });

  it("update with an invalid URL keeps the previous link and warns", async () => {
    const initial = { ...mockPaper, id: "paper-1" } as Paper;
    useAppStore.setState({ papers: [initial] });
    const { capturedUpdates } = buildPapersMock({
      singleResult: { data: initial, error: null },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let ok = false;
    await act(async () => {
      ok = await result.current.updatePaper("paper-1", {
        source_url: "javascript:alert(1)",
      } as any);
    });

    expect(ok).toBe(true);
    expect(capturedUpdates).toHaveLength(1);
    expect(
      (capturedUpdates[0] as Record<string, unknown>).source_url,
    ).toBeUndefined();
    expect(toast.warning).toHaveBeenCalledWith(
      PAPER_SOURCE_URL_WARNING_EDIT,
    );
  });

  it("update with a whitespace-only URL clears the link with no warning", async () => {
    const initial = { ...mockPaper, id: "paper-1" } as Paper;
    useAppStore.setState({ papers: [initial] });
    const { capturedUpdates } = buildPapersMock({
      singleResult: {
        data: { ...initial, source_url: null },
        error: null,
      },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let ok = false;
    await act(async () => {
      ok = await result.current.updatePaper("paper-1", {
        source_url: "   ",
      } as any);
    });

    expect(ok).toBe(true);
    expect(capturedUpdates).toHaveLength(1);
    expect((capturedUpdates[0] as Record<string, unknown>).source_url).toBe(
      null,
    );
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("update with a valid URL trims it and stays silent", async () => {
    const initial = { ...mockPaper, id: "paper-1" } as Paper;
    useAppStore.setState({ papers: [initial] });
    const { capturedUpdates } = buildPapersMock({
      singleResult: { data: initial, error: null },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    await act(async () => {
      await result.current.updatePaper("paper-1", {
        source_url: "  https://example.com/p  ",
      } as any);
    });

    expect(
      (capturedUpdates[0] as Record<string, unknown>).source_url,
    ).toBe("https://example.com/p");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("batch merges invalid + url-dropped + duplicate counts into one toast", async () => {
    const inserted = { ...mockPaper, id: "batch-kept" } as Paper;
    buildPapersMock({ listResult: { data: [inserted], error: null } });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let created: Paper[] = [];
    await act(async () => {
      created = await result.current.createPapers([
        {
          title: "Bad Link",
          authors: [],
          source_url: "javascript:alert(1)",
        },
        { title: "   ", authors: [] },
        { title: "Dup One", authors: [], doi: "10.1111/dup" },
        { title: "Dup Two", authors: [], doi: "10.1111/dup" },
      ] as any);
    });

    expect(created).toEqual([inserted]);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "Saved 1 paper; 1 invalid skipped; 1 source link(s) skipped (unsafe URL); 1 duplicate skipped.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("batch with a DB error fires no skip warning", async () => {
    buildPapersMock({
      listResult: { data: null, error: { message: "db down" } },
    });

    const { result } = renderHook(() => usePapers("test-user-id"));
    let created: Paper[] = [];
    await act(async () => {
      created = await result.current.createPapers([
        {
          title: "Bad Link",
          authors: [],
          source_url: "javascript:alert(1)",
        },
      ] as any);
    });

    expect(created).toEqual([]);
    expect(toast.error).toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
