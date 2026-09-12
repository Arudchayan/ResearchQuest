/**
 * Item 35 — shared ref-counted realtime subscriptions.
 *
 * This module owns Supabase channel *lifecycle* (one channel per
 * table+user, shared across mounts via reference counting). Table hooks own
 * their *merge* logic and pass it in as callbacks.
 *
 * Extracted from the `acquireTasksRealtimeSubscription` /
 * `releaseTasksRealtimeSubscription` pair formerly in `useTasks.ts` so every
 * table hook shares the same single-owner semantics (plan item 47):
 * 1 channel per table per user, `unsubscribe` when the last consumer
 * unmounts, no duplicate `channel()` per userId.
 */
import { supabase } from "./supabase";

export type TableRealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

export interface SubscribeTableOptions<T> {
  /** Postgres event filter. Defaults to "*" (all row changes). */
  event?: "*" | TableRealtimeEvent;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (oldId: string) => void;
}

interface ManagedChannel {
  channel: { unsubscribe: () => unknown };
  refCount: number;
}

const channels = new Map<string, ManagedChannel>();

function releaseChannel(key: string): void {
  const managed = channels.get(key);
  if (!managed) return;
  managed.refCount = Math.max(0, managed.refCount - 1);
  if (managed.refCount > 0) return;
  channels.delete(key);
  try {
    // The Supabase client resolves unsubscribe; test doubles return void.
    // Either way the entry is already dropped, so a later subscriber creates
    // a fresh channel.
    Promise.resolve(managed.channel.unsubscribe()).catch(() => {});
  } catch {
    // Same as above: lifecycle state is already cleaned up.
  }
}

/**
 * Subscribe to row changes on `table` for `userId`.
 *
 * The first caller creates `supabase.channel(\`${table}_realtime_${userId}\`)`;
 * additional callers for the same table+user reuse it. Returns a release
 * function for the effect cleanup — the channel is unsubscribed only when
 * the last consumer releases it. Safe against user switches: each user gets
 * its own keyed entry, and releasing the old key tears that channel down.
 */
export function subscribeTable<T extends { id: string }>(
  table: string,
  userId: string,
  opts: SubscribeTableOptions<T>,
): () => void {
  const key = `${table}:${userId}`;
  const existing = channels.get(key);
  if (existing) {
    existing.refCount += 1;
  } else {
    const channel = supabase
      .channel(`${table}_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: opts.event ?? "*",
          schema: "public",
          table,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            opts.onInsert?.(payload.new as T);
          } else if (payload.eventType === "UPDATE") {
            opts.onUpdate?.(payload.new as T);
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: unknown } | null;
            const oldId = oldRow?.id;
            if (typeof oldId === "string") {
              opts.onDelete?.(oldId);
            }
          }
        },
      )
      .subscribe();
    channels.set(key, { channel, refCount: 1 });
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseChannel(key);
  };
}
