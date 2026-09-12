import { supabase } from "../supabase";
import type {
  FeedItem,
  FeedItemStatus,
  FeedPromoteTarget,
} from "../../types/database";

/**
 * feed_items access (PR15 item 39). The promote request previously lived as a
 * raw `fetch` in `useFeedItems`; the status update mirrors that hook's
 * `update().eq().eq().select("*").single()` chain.
 */

export interface FeedPromoteResponse {
  target: FeedPromoteTarget;
  entity: unknown;
  item: FeedItem;
}

export type FeedPromoteResult =
  | { ok: true; promoted: FeedPromoteResponse }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractMessage(body: unknown, fallback: string): string {
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

export interface PromoteFeedItemArgs {
  itemId: string;
  target: FeedPromoteTarget;
  accessToken: string;
  baseUrl: string;
}

/**
 * POST a feed-item promotion. Never throws for API-level failures — those
 * come back as `{ ok: false, message }` with the same extraction the hook
 * used. Network failures reject, as before.
 */
export async function promoteFeedItemRequest(
  args: PromoteFeedItemArgs,
): Promise<FeedPromoteResult> {
  const response = await fetch(
    `${args.baseUrl}/feed-items/${encodeURIComponent(args.itemId)}/promote`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: args.target }),
    },
  );
  const body: unknown = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      message: extractMessage(body, "Failed to promote feed item"),
    };
  }

  return { ok: true, promoted: body as FeedPromoteResponse };
}

/** Status update with the row returned (hook's optimistic-merge shape). */
export function updateFeedItemStatusRow(
  itemId: string,
  userId: string,
  status: FeedItemStatus,
) {
  return supabase
    .from("feed_items")
    .update({ status })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .single();
}
