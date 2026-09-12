import { awardXP, type GamificationResult } from "./gamification";
import { logger } from "./logger";

/**
 * Batched XP service (PR15 item 36).
 *
 * Callers queue XP events instead of awaiting `awardXP` per action. Events
 * with the same user + action coalesce (amounts summed) and a single flush
 * performs one underlying award call per distinct key — turning the bulk
 * paper-import N x `awardXP` fan-out into a single call (item 37).
 *
 * Demo mode needs no special-casing here: the flush path is `awardXP`,
 * which preserves the historical direct-update behavior in demo mode
 * (see `profilesRepo.writeXpUpdate`).
 */

export interface XpRewardInput {
  xpAmount: number;
  action: string;
}

export interface QueuedXpEvent extends XpRewardInput {
  userId: string;
}

export type XpFlushFn = (
  userId: string,
  xpAmount: number,
  action: string,
) => Promise<GamificationResult | null>;

const xpEventQueue = new Map<string, QueuedXpEvent>();
let scheduledFlush: ReturnType<typeof setTimeout> | null = null;

function enqueue(userId: string, xpAmount: number, action: string): void {
  const key = `${userId}::${action}`;
  const existing = xpEventQueue.get(key);
  if (existing) {
    existing.xpAmount += xpAmount;
  } else {
    xpEventQueue.set(key, { userId, xpAmount, action });
  }
}

function scheduleFlush(): void {
  if (scheduledFlush !== null) return;
  scheduledFlush = setTimeout(() => {
    scheduledFlush = null;
    void flushXpQueue().catch((error: unknown) => {
      logger.error("Scheduled XP flush failed", error);
    });
  }, 0);
}

/**
 * Queue one XP event for a later flush. Same user + action events coalesce.
 * A flush is scheduled asynchronously; call `flushXpQueue` to flush now.
 */
export function queueXpEvent(
  userId: string,
  xpAmount: number,
  action: string,
): void {
  enqueue(userId, xpAmount, action);
  scheduleFlush();
}

/**
 * Flush all queued events: exactly one `flushFn` call per distinct
 * user + action, with the summed XP amount. Never rejects — per-event
 * failures are logged and surface as `null` entries. Returns results in
 * queue-insertion order.
 */
export async function flushXpQueue(
  flushFn: XpFlushFn = awardXP,
): Promise<(GamificationResult | null)[]> {
  const pending = [...xpEventQueue.values()];
  xpEventQueue.clear();
  const results: (GamificationResult | null)[] = [];
  for (const event of pending) {
    try {
      results.push(await flushFn(event.userId, event.xpAmount, event.action));
    } catch (error: unknown) {
      logger.error("Failed to award XP", error);
      results.push(null);
    }
  }
  return results;
}

/**
 * Bulk path (item 37): queue N rewards, then flush exactly once. Returns the
 * per-key results so callers can aggregate them exactly as before.
 */
export async function awardXpBulk(
  userId: string,
  rewards: XpRewardInput[],
  flushFn: XpFlushFn = awardXP,
): Promise<(GamificationResult | null)[]> {
  if (scheduledFlush !== null) {
    clearTimeout(scheduledFlush);
    scheduledFlush = null;
  }
  for (const reward of rewards) {
    enqueue(userId, reward.xpAmount, reward.action);
  }
  return flushXpQueue(flushFn);
}

/** Drop all queued events and cancel a scheduled flush (tests/teardown). */
export function clearXpQueue(): void {
  xpEventQueue.clear();
  if (scheduledFlush !== null) {
    clearTimeout(scheduledFlush);
    scheduledFlush = null;
  }
}

/** Number of distinct queued user + action keys (test introspection). */
export function getQueuedXpCount(): number {
  return xpEventQueue.size;
}
