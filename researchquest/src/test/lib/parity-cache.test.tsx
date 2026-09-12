/**
 * Item 48 — IndexedDB read-through cache + stale-read banner.
 *
 * - Cache-hit renders instantly: a written entry reads back synchronously
 *   (no network) with `stale: false`.
 * - Stale banner shows/hides: `markStaleKeys` surfaces the banner,
 *   `clearStaleKeys` hides it.
 * - TTL expiry refetches: expired entries still return their rows (so the
 *   list paints immediately) flagged `stale: true`, signalling the caller
 *   to revalidate and banner.
 */
import { describe, expect, it, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  cacheKeyForList,
  clearAllStaleKeys,
  clearListCache,
  clearStaleKeys,
  getStaleKeysSnapshot,
  markStaleKeys,
  readListCache,
  writeListCache,
} from "../../lib/idbCache";
import { StaleBanner } from "../../components/layout/StaleBanner";

const KEY = cacheKeyForList("notes", "user-1");

afterEach(async () => {
  await clearListCache();
  clearAllStaleKeys();
  vi.restoreAllMocks();
});

describe("idbCache list cache (item 48)", () => {
  it("returns a cache-hit instantly with stale:false", async () => {
    const rows = [{ id: "n1", title: "Cached note" }];
    await writeListCache(KEY, rows);

    const hit = await readListCache<{ id: string }>(KEY);
    expect(hit).not.toBeNull();
    expect(hit?.data).toEqual(rows);
    expect(hit?.stale).toBe(false);
  });

  it("returns null on a cache miss", async () => {
    await expect(readListCache(KEY)).resolves.toBeNull();
  });

  it("flags TTL-expired entries as stale while still returning rows", async () => {
    const rows = [{ id: "n1", title: "Old note" }];
    await writeListCache(KEY, rows);

    const expired = await readListCache<{ id: string }>(KEY, -1);
    expect(expired).not.toBeNull();
    expect(expired?.data).toEqual(rows);
    expect(expired?.stale).toBe(true);
  });

  it("drops entries after clearListCache", async () => {
    await writeListCache(KEY, [{ id: "n1" }]);
    await clearListCache();
    await expect(readListCache(KEY)).resolves.toBeNull();
  });

  it("tracks stale keys for the banner signal", () => {
    expect(getStaleKeysSnapshot()).toEqual([]);
    markStaleKeys(KEY);
    expect(getStaleKeysSnapshot()).toEqual([KEY]);
    // Idempotent — no duplicate entries, no extra notifications.
    markStaleKeys(KEY);
    expect(getStaleKeysSnapshot()).toEqual([KEY]);
    clearStaleKeys(KEY);
    expect(getStaleKeysSnapshot()).toEqual([]);
  });
});

describe("StaleBanner (item 48)", () => {
  it("is hidden when no stale data is shown", () => {
    render(<StaleBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows while stale data renders and hides after revalidation", () => {
    render(<StaleBanner />);
    act(() => {
      markStaleKeys(KEY);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/cached data/i);

    act(() => {
      clearStaleKeys(KEY);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
