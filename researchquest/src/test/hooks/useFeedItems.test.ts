import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import "../mocks/supabase";
import { mockSupabaseClient } from "../mocks/supabase";
import {
  applyFeedItemKeysetCursor,
  applyFeedItemListFilters,
  applyFeedItemOlderThanFilter,
  buildPromotePaperFields,
  feedItemsKeysetOrFilter,
  getApiBaseUrl,
  mergeRealtimeFeedItem,
  useFeedItems,
} from "../../hooks/useFeedItems";
import { useFeedItemsStore } from "../../store/feedItemsStore";
import type { FeedItem } from "../../types/database";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "item-1",
    user_id: "user-1",
    source_id: null,
    type: "paper",
    title: "Seed item",
    summary: "Abstract text",
    url: "https://arxiv.org/abs/1706.03762",
    payload: {
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      arxiv_id: "1706.03762",
    },
    status: "new",
    external_id: "arxiv:1706.03762",
    published_at: "2026-09-20T12:00:00.000Z",
    created_at: "2026-09-21T12:00:00.000Z",
    updated_at: "2026-09-21T12:00:00.000Z",
    ...overrides,
  };
}

function createRecorder() {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: {
    calls: Array<[string, ...unknown[]]>;
    eq: (column: string, value: unknown) => typeof builder;
    neq: (column: string, value: unknown) => typeof builder;
    or: (filters: string) => typeof builder;
    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean },
    ) => typeof builder;
    limit: (count: number) => typeof builder;
  } = {
    calls,
    eq: (column, value) => {
      calls.push(["eq", column, value]);
      return builder;
    },
    neq: (column, value) => {
      calls.push(["neq", column, value]);
      return builder;
    },
    or: (filters) => {
      calls.push(["or", filters]);
      return builder;
    },
    order: (column, options) => {
      calls.push(["order", column, options]);
      return builder;
    },
    limit: (count) => {
      calls.push(["limit", count]);
      return builder;
    },
  };
  return builder;
}

function createBuilder(result: {
  data?: unknown;
  error?: unknown;
  count?: number | null;
} = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  const chain = (...args: unknown[]) => {
    const method = args[0] as string;
    calls.push([method, ...args.slice(1)]);
    return builder;
  };
  for (const method of [
    "select",
    "eq",
    "neq",
    "or",
    "is",
    "order",
    "limit",
    "in",
    "update",
  ]) {
    builder[method] = vi.fn((...args: unknown[]) => chain(method, ...args));
  }
  builder.single = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }));
  builder.then = (onFulfilled?: (value: unknown) => unknown) =>
    Promise.resolve({
      data: result.data ?? [],
      error: result.error ?? null,
      count: result.count ?? null,
    }).then(onFulfilled);
  return builder as typeof builder & {
    calls: Array<[string, ...unknown[]]>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
  };
}

describe("useFeedItems getApiBaseUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the gateway base URL and trims a trailing slash", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co/");
    expect(getApiBaseUrl()).toBe(
      "https://example.supabase.co/functions/v1/api/v1",
    );
  });

  it("throws an explicit error when VITE_SUPABASE_URL is empty", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(() => getApiBaseUrl()).toThrow("Supabase URL is not configured.");
  });

  it("throws an explicit error when VITE_SUPABASE_URL is undefined", () => {
    vi.stubEnv("VITE_SUPABASE_URL", undefined as unknown as string);
    expect(() => getApiBaseUrl()).toThrow("Supabase URL is not configured.");
  });
});

describe("feed inbox query builder", () => {
  it("applies user, type, and status filters on the query", () => {
    const builder = createRecorder();
    applyFeedItemListFilters(builder, {
      userId: "user-1",
      type: "job",
      status: "new",
    });
    expect(builder.calls).toEqual([
      ["eq", "user_id", "user-1"],
      ["eq", "type", "job"],
      ["eq", "status", "new"],
    ]);
  });

  it("omits type and status equality when the filter is all", () => {
    const builder = createRecorder();
    applyFeedItemListFilters(builder, {
      userId: "user-1",
      type: "all",
      status: "all",
    });
    expect(builder.calls).toEqual([["eq", "user_id", "user-1"]]);
  });

  it("builds a keyset cursor that pages older dated rows then NULL published_at", () => {
    const filter = feedItemsKeysetOrFilter({
      published_at: "2026-09-20T12:00:00.000Z",
      created_at: "2026-09-21T12:00:00.000Z",
      id: "item-100",
    });
    expect(filter).toContain(
      'published_at.lt."2026-09-20T12:00:00.000Z"',
    );
    expect(filter).toContain(
      'and(published_at.eq."2026-09-20T12:00:00.000Z",created_at.lt."2026-09-21T12:00:00.000Z")',
    );
    expect(filter).toContain(
      'and(published_at.eq."2026-09-20T12:00:00.000Z",created_at.eq."2026-09-21T12:00:00.000Z",id.lt."item-100")',
    );
    expect(filter).toContain("published_at.is.null");
  });

  it("keeps NULL published_at keyset inside the nulls-last partition", () => {
    const filter = feedItemsKeysetOrFilter({
      published_at: null,
      created_at: "2026-01-02T00:00:00.000Z",
      id: "null-row",
    });
    expect(filter).toContain(
      'and(published_at.is.null,created_at.lt."2026-01-02T00:00:00.000Z")',
    );
    expect(filter).toContain(
      'and(published_at.is.null,created_at.eq."2026-01-02T00:00:00.000Z",id.lt."null-row")',
    );
    expect(filter).not.toContain("published_at.lt.");
  });

  it("does not apply a keyset or() filter when there is no cursor", () => {
    const builder = createRecorder();
    applyFeedItemKeysetCursor(builder, null);
    expect(builder.calls).toEqual([]);
  });

  it("applies the keyset or() filter when a cursor is present", () => {
    const builder = createRecorder();
    applyFeedItemKeysetCursor(builder, {
      published_at: null,
      created_at: "2026-01-02T00:00:00.000Z",
      id: "null-row",
    });
    expect(builder.calls[0]?.[0]).toBe("or");
    expect(String(builder.calls[0]?.[1])).toContain("published_at.is.null");
  });

  it("older-than filter matches published_at, or created_at when published_at is NULL", () => {
    const builder = createRecorder();
    applyFeedItemOlderThanFilter(builder, 7, new Date("2026-09-28T00:00:00.000Z"));
    expect(builder.calls).toHaveLength(1);
    expect(builder.calls[0]?.[0]).toBe("or");
    const filter = String(builder.calls[0]?.[1]);
    expect(filter).toContain('published_at.lt."2026-09-21T00:00:00.000Z"');
    expect(filter).toContain(
      'and(published_at.is.null,created_at.lt."2026-09-21T00:00:00.000Z")',
    );
  });

  it("skips the older-than filter when days are not set", () => {
    const builder = createRecorder();
    applyFeedItemOlderThanFilter(builder, null, new Date("2026-09-28T00:00:00.000Z"));
    expect(builder.calls).toEqual([]);
  });
});

describe("mergeRealtimeFeedItem", () => {
  const existing = createFeedItem({ id: "item-1" });

  it("inserts a matching row at the top and dedupes by id", () => {
    const incoming = createFeedItem({
      id: "item-2",
      title: "Newer paper",
      published_at: "2026-09-27T12:00:00.000Z",
    });
    const first = mergeRealtimeFeedItem([existing], {
      eventType: "INSERT",
      new: incoming,
      old: null,
    }, { type: "all", status: "new", userId: "user-1" });
    expect(first.items.map((item) => item.id)).toEqual(["item-2", "item-1"]);
    expect(first.countDelta).toBe(1);

    const duped = mergeRealtimeFeedItem(first.items, {
      eventType: "INSERT",
      new: { ...incoming, title: "Newer paper (retry)" },
      old: null,
    }, { type: "all", status: "new", userId: "user-1" });
    expect(duped.items).toHaveLength(2);
    expect(duped.items[0]?.title).toBe("Newer paper (retry)");
    expect(duped.countDelta).toBe(0);
  });

  it("ignores inserts that do not match the active filters", () => {
    const job = createFeedItem({ id: "job-1", type: "job", title: "Hiring" });
    const result = mergeRealtimeFeedItem([existing], {
      eventType: "INSERT",
      new: job,
      old: null,
    }, { type: "paper", status: "new", userId: "user-1" });
    expect(result.items).toEqual([existing]);
    expect(result.countDelta).toBe(0);
  });

  it("removes an updated row that no longer matches the status filter", () => {
    const result = mergeRealtimeFeedItem([existing], {
      eventType: "UPDATE",
      new: { ...existing, status: "archived" },
      old: { id: existing.id },
    }, { type: "all", status: "new", userId: "user-1" });
    expect(result.items).toEqual([]);
    expect(result.countDelta).toBe(-1);
  });
});

describe("buildPromotePaperFields", () => {
  it("maps arXiv title, authors, id/URL, and abstract onto the promote body", () => {
    const fields = buildPromotePaperFields(
      createFeedItem({
        title: "Attention Is All You Need",
        summary: "We propose a new simple network architecture.",
      }),
    );
    expect(fields).toMatchObject({
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      abstract: "We propose a new simple network architecture.",
      source_url: "https://arxiv.org/abs/1706.03762",
    });
  });

  it("synthesizes an arXiv abs URL from external_id when url is missing", () => {
    const fields = buildPromotePaperFields(
      createFeedItem({
        url: null,
        payload: { authors: ["A. Author"] },
        external_id: "arxiv:2305.14552",
      }),
    );
    expect(fields.source_url).toBe("https://arxiv.org/abs/2305.14552");
  });
});

describe("useFeedItems missing-env path", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    useFeedItemsStore.setState({ items: [], loading: true, error: null });
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("promoteFeedItem fails closed without calling fetch when the URL is not configured", async () => {
    useFeedItemsStore.setState({
      items: [createFeedItem()],
      loading: false,
      error: null,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      const { result } = renderHook(() => useFeedItems("user-1"));

      let promoted: unknown = "unset";
      await act(async () => {
        promoted = await result.current.promoteFeedItem("item-1", "paper");
      });

      expect(promoted).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.error).toBe("Failed to promote feed item");
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });
});

describe("useFeedItems paged inbox", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    useFeedItemsStore.setState({ items: [], loading: true, error: null });
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.info).mockReset();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("applies status/type filters server-side and uses an exact head count", async () => {
    const listBuilder = createBuilder({
      data: [createFeedItem()],
      count: null,
    });
    const countBuilder = createBuilder({ data: [], count: 859 });
    mockSupabaseClient.from.mockImplementation(() => {
      const select = mockSupabaseClient.from.mock.calls.length;
      return select % 2 === 1 ? listBuilder : countBuilder;
    });

    const { result } = renderHook(() =>
      useFeedItems("user-1", {
        type: "job",
        status: "new",
        paged: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalCount).toBe(859);
    expect(listBuilder.eq).toHaveBeenCalledWith("type", "job");
    expect(listBuilder.eq).toHaveBeenCalledWith("status", "new");
    expect(countBuilder.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(countBuilder.eq).toHaveBeenCalledWith("type", "job");
    expect(countBuilder.eq).toHaveBeenCalledWith("status", "new");
  });

  it("loadOlder pages with a keyset cursor instead of replacing the first page", async () => {
    const firstPage = createFeedItem({ id: "item-1" });
    const older = createFeedItem({
      id: "item-2",
      published_at: "2026-01-01T00:00:00.000Z",
    });
    let listCalls = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      const isCount = mockSupabaseClient.from.mock.calls.some(
        (call, index, calls) =>
          calls[index] === call &&
          false,
      );
      void isCount;
      listCalls += 1;
      if (listCalls === 1) {
        return createBuilder({ data: [firstPage] });
      }
      if (listCalls === 2) {
        return createBuilder({ data: [], count: 2 });
      }
      if (listCalls === 3) {
        const olderBuilder = createBuilder({ data: [older] });
        return olderBuilder;
      }
      return createBuilder({ data: [], count: 2 });
    });

    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "new", paged: true }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    await act(async () => {
      await result.current.loadOlderFeedItems();
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual([
        "item-1",
        "item-2",
      ]);
    });
  });

  it("archiveMatchingFeedItems confirms the exact count, updates once, and rolls back on error", async () => {
    const item = createFeedItem();
    const builders: ReturnType<typeof createBuilder>[] = [];
    mockSupabaseClient.from.mockImplementation(() => {
      const next = builders.length === 0
        ? createBuilder({ data: [item] })
        : builders.length === 1
        ? createBuilder({ data: [], count: 3 })
        : builders.length === 2
        ? createBuilder({ data: [], count: 3 })
        : createBuilder({ data: null, error: { message: "archive failed" } });
      builders.push(next);
      return next;
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "new", paged: true }),
    );

    await waitFor(() => {
      expect(result.current.totalCount).toBe(3);
    });

    let archived = true;
    await act(async () => {
      archived = await result.current.archiveMatchingFeedItems();
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("3"),
    );
    expect(archived).toBe(false);
    expect(result.current.items).toEqual([item]);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.error).toMatch(/archive failed|Feed update failed/i);
    expect(toast.error).toHaveBeenCalled();
    const updateBuilder = builders.find((builder) =>
      builder.calls.some((call) => call[0] === "update"),
    );
    expect(updateBuilder?.update).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it("promoteFeedItem posts arXiv fields and ignores a second in-flight click", async () => {
    const item = createFeedItem({
      title: "Attention Is All You Need",
    });
    mockSupabaseClient.from.mockImplementation(() =>
      createBuilder({ data: [item], count: 1 }),
    );
    let resolvePromote: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromote = resolve;
        }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "new", paged: true }),
    );
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    let first: Promise<unknown> | undefined;
    let second: Promise<unknown> | undefined;
    await act(async () => {
      first = result.current.promoteFeedItem("item-1", "paper");
      second = result.current.promoteFeedItem("item-1", "paper");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      target: "paper",
      title: "Attention Is All You Need",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      source_url: "https://arxiv.org/abs/1706.03762",
    });

    resolvePromote?.({
      ok: true,
      json: async () => ({
        target: "paper",
        entity: { id: "paper-1" },
        item: { ...item, status: "promoted" },
      }),
    });
    await act(async () => {
      await first;
      await second;
    });
    confirmSpy.mockRestore();
  });
});
