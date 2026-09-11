import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useFeedItems,
  resetFeedChannelsForTests,
} from "../../hooks/useFeedItems";
import { mockSupabaseClient } from "../mocks/supabase";
import type { FeedItem } from "../../types/database";

// Mock toast (useFeedItems imports sonner)
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

const makeItem = (index: number): FeedItem => ({
  id: `feed-${index}`,
  user_id: "user-1",
  type: "news",
  title: `Item ${index}`,
  payload: {},
  status: "new",
  published_at: new Date(Date.UTC(2026, 0, 10 - index)).toISOString(),
  created_at: new Date(Date.UTC(2026, 0, 10 - index)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 0, 10 - index)).toISOString(),
});

// 7 rows so pageSize 3 yields: page1 full (hasMore) -> page2 full (hasMore) ->
// page3 partial (done).
const ALL_ROWS = Array.from({ length: 7 }, (_, i) => makeItem(i));

const rangeCalls: Array<[number, number]> = [];

function installRangeMock() {
  rangeCalls.length = 0;
  vi.mocked(mockSupabaseClient.from).mockImplementation((() => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.range = vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      return builder;
    });
    builder.then = (onFulfilled?: (value: any) => any) => {
      const [from, to] =
        rangeCalls.length > 0 ? rangeCalls[rangeCalls.length - 1] : [0, 2];
      const result = { data: ALL_ROWS.slice(from, to + 1), error: null };
      return Promise.resolve(result).then(onFulfilled);
    };
    return builder;
  }) as any);
}

describe("useFeedItems pagination (plan item 41)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeedChannelsForTests();
    installRangeMock();
  });

  it("fetches the first page with range() and reports hasMore on a full window", async () => {
    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "all", pageSize: 3 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(rangeCalls[0]).toEqual([0, 2]);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.hasMore).toBe(true);
  });

  it("loadMore() grows the window via range() until rows run out", async () => {
    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "all", pageSize: 3 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() =>
      expect(rangeCalls).toContainEqual([0, 5]),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    await waitFor(() =>
      expect(rangeCalls).toContainEqual([0, 8]),
    );
    await waitFor(() => expect(result.current.items).toHaveLength(7));
    expect(result.current.hasMore).toBe(false);
  });

  it("keeps a fixed window when `limit` is given without pageSize (rail)", async () => {
    const { result } = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "new", limit: 5 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(rangeCalls[0]).toEqual([0, 4]);
    expect(result.current.items).toHaveLength(5);
  });
});

describe("useFeedItems realtime single-owner (plan item 47) + dedupe (46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeedChannelsForTests();
    installRangeMock();
  });

  it("opens one channel per userId shared by concurrent instances", async () => {
    const hookA = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "all", pageSize: 3 }),
    );
    const hookB = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "new", pageSize: 3 }),
    );
    await waitFor(() => expect(hookA.result.current.loading).toBe(false));
    await waitFor(() => expect(hookB.result.current.loading).toBe(false));

    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
      "feed_items_realtime_user-1",
    );

    // Unmounting one instance keeps the shared channel alive...
    hookA.unmount();
    const sub = vi.mocked(mockSupabaseClient.channel).mock.results[0].value
      .subscribe.mock.results[0].value;
    expect(sub.unsubscribe).not.toHaveBeenCalled();

    // ...unmounting the last one closes it.
    hookB.unmount();
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent identical fetches into one range() request", async () => {
    const hookA = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "all", pageSize: 3 }),
    );
    // Second instance mounts while the first fetch is still in flight.
    const hookB = renderHook(() =>
      useFeedItems("user-1", { type: "all", status: "all", pageSize: 3 }),
    );
    await waitFor(() => expect(hookA.result.current.loading).toBe(false));
    await waitFor(() => expect(hookB.result.current.loading).toBe(false));

    expect(rangeCalls).toEqual([[0, 2]]);
    expect(hookB.result.current.items).toHaveLength(3);
  });
});
