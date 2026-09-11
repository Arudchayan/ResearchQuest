import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePaginatedList, useDebouncedValue } from "../../hooks/usePaginatedList";

describe("usePaginatedList", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  it("shows the first page and grows with loadMore", () => {
    const { result } = renderHook(() => usePaginatedList(items, 50));
    expect(result.current.visibleItems).toHaveLength(50);
    expect(result.current.totalCount).toBe(120);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(100);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(120);
    expect(result.current.hasMore).toBe(false);

    // loadMore at the end is a no-op
    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(120);
  });

  it("resets the window when the item identity changes", () => {
    const { result, rerender } = renderHook(
      ({ list }: { list: number[] }) => usePaginatedList(list, 50),
      { initialProps: { list: items } },
    );
    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(100);

    rerender({ list: Array.from({ length: 10 }, (_, i) => i) });
    expect(result.current.visibleItems).toHaveLength(10);
    expect(result.current.hasMore).toBe(false);
  });

  it("reset() collapses back to the first page", () => {
    const { result } = renderHook(() => usePaginatedList(items, 50));
    act(() => result.current.loadMore());
    act(() => result.current.reset());
    expect(result.current.visibleItems).toHaveLength(50);
    expect(result.current.visibleCount).toBe(50);
  });
});

describe("useDebouncedValue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("holds the old value until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("ab");
  });

  it("restarts the delay on rapid typing", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "abc" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("abc");
  });
});
