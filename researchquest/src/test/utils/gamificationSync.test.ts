import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAwardXP } = vi.hoisted(() => ({ mockAwardXP: vi.fn() }));

vi.mock("../../utils/gamification", () => ({
  awardXP: mockAwardXP,
}));

import {
  queueXpEvent,
  flushXpQueue,
  awardXpBulk,
  clearXpQueue,
  getQueuedXpCount,
} from "../../utils/gamificationSync";

describe("gamificationSync XP batching", () => {
  beforeEach(() => {
    clearXpQueue();
    vi.clearAllMocks();
  });

  it("coalesces N queued events for the same user+action into one flush call", async () => {
    mockAwardXP.mockResolvedValue({ xpEarned: 30 });

    queueXpEvent("user-a", 10, "create_paper");
    queueXpEvent("user-a", 10, "create_paper");
    queueXpEvent("user-a", 10, "create_paper");
    expect(getQueuedXpCount()).toBe(1);

    const results = await flushXpQueue();

    expect(mockAwardXP).toHaveBeenCalledTimes(1);
    expect(mockAwardXP).toHaveBeenCalledWith("user-a", 30, "create_paper");
    expect(results).toHaveLength(1);
    expect(getQueuedXpCount()).toBe(0);
  });

  it("keeps distinct user+action buckets separate", async () => {
    mockAwardXP.mockResolvedValue({ xpEarned: 10 });

    queueXpEvent("user-a", 10, "create_paper");
    queueXpEvent("user-a", 5, "create_note");
    queueXpEvent("user-b", 10, "create_paper");

    await flushXpQueue();

    expect(mockAwardXP).toHaveBeenCalledTimes(3);
    expect(mockAwardXP).toHaveBeenCalledWith("user-a", 10, "create_paper");
    expect(mockAwardXP).toHaveBeenCalledWith("user-a", 5, "create_note");
    expect(mockAwardXP).toHaveBeenCalledWith("user-b", 10, "create_paper");
  });

  it("flushes an empty queue to an empty result without calling through", async () => {
    const results = await flushXpQueue();

    expect(results).toEqual([]);
    expect(mockAwardXP).not.toHaveBeenCalled();
  });

  it("never rejects: a failing award resolves to null and lets others through", async () => {
    queueXpEvent("user-a", 10, "create_paper");
    queueXpEvent("user-a", 5, "create_note");

    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({ xpEarned: 5 });

    const results = await flushXpQueue(flaky);

    expect(results).toEqual([null, { xpEarned: 5 }]);
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(getQueuedXpCount()).toBe(0);
  });

  it("awardXpBulk queues N rewards and flushes them as one call", async () => {
    mockAwardXP.mockResolvedValue({ xpEarned: 30 });

    const results = await awardXpBulk("user-a", [
      { xpAmount: 10, action: "create_paper" },
      { xpAmount: 10, action: "create_paper" },
      { xpAmount: 10, action: "create_paper" },
    ]);

    expect(mockAwardXP).toHaveBeenCalledTimes(1);
    expect(mockAwardXP).toHaveBeenCalledWith("user-a", 30, "create_paper");
    expect(results).toHaveLength(1);
    expect(getQueuedXpCount()).toBe(0);
  });

  it("awardXpBulk resolves per-bucket results and never rejects on failure", async () => {
    mockAwardXP.mockRejectedValueOnce(new Error("db down"));
    mockAwardXP.mockResolvedValue({ xpEarned: 5 });

    const results = await awardXpBulk(
      "user-a",
      [
        { xpAmount: 10, action: "create_paper" },
        { xpAmount: 5, action: "create_note" },
      ],
      (userId: string, xp: number, action: string) =>
        mockAwardXP(userId, xp, action),
    );

    expect(results).toEqual([null, { xpEarned: 5 }]);
    expect(getQueuedXpCount()).toBe(0);
  });

  it("awardXpBulk with no rewards resolves empty without calling through", async () => {
    const results = await awardXpBulk("user-a", []);

    expect(results).toEqual([]);
    expect(mockAwardXP).not.toHaveBeenCalled();
  });
});
