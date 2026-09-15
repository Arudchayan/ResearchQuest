import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServerSearch } from "../../hooks/useServerSearch";
import { useAppStore } from "../../store/appStore";
import type { UserProfile } from "../../types/database";
import { mockSupabaseClient } from "../mocks/supabase";

const testUser = { id: "user-1" } as UserProfile;
const clientRows = [{ id: "c1" }, { id: "c2" }];

async function settleDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

describe("useServerSearch overlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSupabaseClient.rpc.mockReset();
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
    act(() => useAppStore.setState({ user: testUser }));
  });
  afterEach(() => {
    vi.useRealTimers();
    act(() => useAppStore.setState({ user: null }));
  });

  it("returns client results untouched for empty queries (no RPC)", () => {
    const { result } = renderHook(() =>
      useServerSearch({ query: "   ", entity: "notes", clientResults: clientRows }),
    );
    expect(result.current.results).toBe(clientRows);
    expect(result.current.source).toBe("client");
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it("shows client rows instantly, then keeps them when the RPC has no FTS rows", async () => {
    const { result } = renderHook(() =>
      useServerSearch({ query: "quantum", entity: "notes", clientResults: clientRows }),
    );
    // Debounce pending: instant client list.
    expect(result.current.results).toBe(clientRows);
    expect(result.current.source).toBe("client");

    await settleDebounce();
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("search_notes", {
      search_user_id: "user-1",
      search_query: "quantum",
      limit_count: 20,
    });
    // RPC returned null (demo/no FTS): client list preserved.
    expect(result.current.results).toBe(clientRows);
    expect(result.current.source).toBe("client");
  });

  it("swaps in server rows once the RPC resolves", async () => {
    const serverRows = [{ id: "s1" }, { id: "s2" }];
    mockSupabaseClient.rpc.mockResolvedValue({ data: serverRows, error: null });
    const { result } = renderHook(() =>
      useServerSearch({ query: "quantum", entity: "papers", clientResults: clientRows }),
    );
    await settleDebounce();
    expect(result.current.source).toBe("server");
    expect(result.current.results).toBe(serverRows);
  });

  it("debounces rapid typing into a single RPC with the latest query", async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useServerSearch({ query, entity: "ideas", clientResults: clientRows }),
      { initialProps: { query: "" } },
    );
    rerender({ query: "quant" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    rerender({ query: "quantum" });
    await settleDebounce();
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "search_ideas",
      expect.objectContaining({ search_query: "quantum" }),
    );
    expect(result.current.results).toBe(clientRows);
  });

  it("discards stale RPC responses (generation guard)", async () => {
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const first = new Promise((r) => (resolveFirst = r));
    const second = new Promise((r) => (resolveSecond = r));
    mockSupabaseClient.rpc
      .mockReturnValueOnce(first as never)
      .mockReturnValueOnce(second as never);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useServerSearch({ query, entity: "notes", clientResults: clientRows }),
      { initialProps: { query: "quant" } },
    );
    await settleDebounce();
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(1);

    rerender({ query: "quantum" });
    await settleDebounce();
    expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);

    // Late first response must not clobber the newer query's rows.
    await act(async () => {
      resolveFirst({ data: [{ id: "stale" }], error: null });
      resolveSecond({ data: [{ id: "fresh" }], error: null });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.source).toBe("server");
    expect(result.current.results).toEqual([{ id: "fresh" }]);
  });

  it("falls back to client rows when the RPC rejects", async () => {
    mockSupabaseClient.rpc.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() =>
      useServerSearch({ query: "quantum", entity: "notes", clientResults: clientRows }),
    );
    await settleDebounce();
    expect(result.current.results).toBe(clientRows);
    expect(result.current.source).toBe("client");
  });
});
