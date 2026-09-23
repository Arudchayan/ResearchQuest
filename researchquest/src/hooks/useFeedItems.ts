import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isDemoMode, supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import type {
  FeedItem,
  FeedItemStatus,
  FeedItemType,
  FeedPromoteTarget,
  Note,
  Paper,
  Task,
} from "../types/database";
import { logger } from "../utils/logger";

export const FEED_ITEM_TYPES = ["paper", "job", "news", "custom"] as const;
export const FEED_ITEM_STATUSES = [
  "new",
  "triaged",
  "archived",
  "promoted",
] as const;

export type FeedTypeFilter = FeedItemType | "all";
export type FeedStatusFilter = FeedItemStatus | "all";

export type FeedBusyAction = "archive" | "triage" | "promote";

export interface FeedBusyState {
  itemId: string;
  action: FeedBusyAction;
}

interface UseFeedItemsOptions {
  type?: FeedTypeFilter;
  status?: FeedStatusFilter;
  limit?: number;
  enabled?: boolean;
}

interface PromoteResponse {
  target: FeedPromoteTarget;
  entity: unknown;
  item: FeedItem;
}

const PROMOTE_ENTITY_TABLE: Record<FeedPromoteTarget, "papers" | "tasks" | "notes"> = {
  paper: "papers",
  task: "tasks",
  note: "notes",
};

const PROMOTE_VIEW_LABEL: Record<FeedPromoteTarget, string> = {
  paper: "View paper",
  task: "View tasks",
  note: "View note",
};

function compareFeedItems(a: FeedItem, b: FeedItem) {
  const aTime = Date.parse(a.published_at ?? a.created_at);
  const bTime = Date.parse(b.published_at ?? b.created_at);
  return bTime - aTime;
}

function sortFeedItems(items: FeedItem[]) {
  return [...items].sort(compareFeedItems);
}

function feedItemMatchesFilters(
  item: FeedItem,
  type: FeedTypeFilter,
  status: FeedStatusFilter,
) {
  return (type === "all" || item.type === type) &&
    (status === "all" || item.status === status);
}

export function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Supabase URL is not configured.");
  }
  return `${baseUrl}/functions/v1/api/v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiErrorMessage(body: unknown, fallback: string) {
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

function extractEntityId(entity: unknown): string | null {
  if (isRecord(entity) && typeof entity.id === "string" && entity.id) {
    return entity.id;
  }
  return null;
}

function navigateToPromotedEntity(target: FeedPromoteTarget, entityId: string | null) {
  const store = useAppStore.getState();
  if (target === "paper") {
    const paper = store.papers.find((item) => item.id === entityId) ?? null;
    store.setSelectedPaper(paper);
    store.setCurrentView("papers");
    window.history.pushState(null, "", entityId ? `/papers/${entityId}` : "/papers");
  } else if (target === "task") {
    const task = store.tasks.find((item) => item.id === entityId) ?? null;
    store.setSelectedTask(task);
    store.setCurrentView("tasks");
    window.history.pushState(null, "", "/tasks");
  } else {
    const note = store.notes.find((item) => item.id === entityId) ?? null;
    store.setSelectedNote(note);
    store.setCurrentView("notes");
    window.history.pushState(null, "", entityId ? `/notes/${entityId}` : "/notes");
  }
}

export function useFeedItems(
  userId: string | undefined,
  options: UseFeedItemsOptions = {},
) {
  const { type = "all", status = "all", limit, enabled = true } = options;
  const [baseItems, setBaseItems] = useState<FeedItem[]>([]);
  const [keptTriaged, setKeptTriaged] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<FeedBusyState | null>(null);

  // Items the user triaged while filtering by `new` stay visible with a
  // `triaged` badge instead of silently vanishing from the list.
  const items = useMemo(() => {
    if (status !== "new") return baseItems;
    const visible = [...baseItems];
    for (const kept of keptTriaged) {
      if (type !== "all" && kept.type !== type) continue;
      if (visible.some((item) => item.id === kept.id)) continue;
      visible.push(kept);
    }
    return sortFeedItems(visible);
  }, [baseItems, keptTriaged, status, type]);

  // The keep-visible set only applies to the `new` filter.
  useEffect(() => {
    if (status !== "new") setKeptTriaged([]);
  }, [status]);

  const fetchFeedItems = useCallback(async () => {
    if (!userId || !enabled) {
      setBaseItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("feed_items")
        .select("*")
        .eq("user_id", userId);

      if (type !== "all") {
        query = query.eq("type", type);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }

      query = query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error("Failed to fetch feed items", fetchError);
        setError("Failed to load feeds");
        return;
      }

      setBaseItems(sortFeedItems((data ?? []) as FeedItem[]));
    } catch (fetchError) {
      logger.error("Failed to fetch feed items", fetchError);
      setError("Failed to load feeds");
    } finally {
      setLoading(false);
    }
  }, [enabled, limit, status, type, userId]);

  useEffect(() => {
    void fetchFeedItems();

    if (!userId || !enabled) {
      return;
    }

    const subscription = supabase
      .channel(`feed_items_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_items",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchFeedItems();
        },
      )
      .subscribe((subscriptionStatus) => {
        logger.log("Feed items subscription status:", subscriptionStatus);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, fetchFeedItems, userId]);

  const updateFeedItemStatus = useCallback(
    async (itemId: string, nextStatus: Extract<FeedItemStatus, "new" | "triaged" | "archived">) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }

      const busy: FeedBusyState = {
        itemId,
        action: nextStatus === "archived" ? "archive" : "triage",
      };
      const previousBase = baseItems;
      const previousKept = keptTriaged;
      setBusyAction(busy);
      setBaseItems((current) =>
        current
          .map((item) =>
            item.id === itemId
              ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
              : item,
          )
          .filter((item) => feedItemMatchesFilters(item, type, status)),
      );
      if (nextStatus === "archived") {
        setKeptTriaged((current) => current.filter((item) => item.id !== itemId));
      }

      const { data, error: updateError } = await supabase
        .from("feed_items")
        .update({ status: nextStatus })
        .eq("id", itemId)
        .eq("user_id", userId)
        .select("*")
        .single();

      setBusyAction(null);

      if (updateError || !data) {
        logger.error("Failed to update feed item status", updateError);
        setBaseItems(previousBase);
        setKeptTriaged(previousKept);
        toast.error("Failed to update feed item");
        return false;
      }

      const updated = data as FeedItem;
      setBaseItems((current) => {
        const merged = current.some((item) => item.id === updated.id)
          ? current.map((item) => (item.id === updated.id ? updated : item))
          : [updated, ...current];
        return sortFeedItems(
          merged.filter((item) => feedItemMatchesFilters(item, type, status)),
        );
      });

      if (nextStatus === "triaged") {
        if (status === "new") {
          // Keep the item in view with its `triaged` badge (item 66).
          setKeptTriaged((current) => {
            const merged = current.some((item) => item.id === updated.id)
              ? current.map((item) => (item.id === updated.id ? updated : item))
              : [updated, ...current];
            return merged.slice(0, 20);
          });
          toast.success("Marked as triaged", {
            action: {
              label: "Undo",
              onClick: () => {
                void updateFeedItemStatus(itemId, "new");
              },
            },
          });
        } else {
          toast.success("Marked as triaged");
        }
      }

      if (nextStatus === "archived") {
        toast.success("Feed item archived");
      }
      return true;
    },
    [baseItems, keptTriaged, status, type, userId],
  );

  const archiveFeedItem = useCallback(
    (itemId: string) => updateFeedItemStatus(itemId, "archived"),
    [updateFeedItemStatus],
  );

  const markFeedItemTriaged = useCallback(
    (itemId: string) => updateFeedItemStatus(itemId, "triaged"),
    [updateFeedItemStatus],
  );

  const undoPromote = useCallback(
    async (params: {
      itemId: string;
      previousItem: FeedItem;
      createdEntityId: string | null;
      target: FeedPromoteTarget;
      deleteCreatedEntity: boolean;
    }) => {
      const { itemId, previousItem, createdEntityId, target, deleteCreatedEntity } = params;
      if (!userId) return;

      if (deleteCreatedEntity && createdEntityId) {
        const table = PROMOTE_ENTITY_TABLE[target];
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq("id", createdEntityId)
          .eq("user_id", userId);
        if (deleteError) {
          logger.error("Failed to undo feed promote", deleteError);
          toast.error("Could not undo promote");
          return;
        }
        const store = useAppStore.getState();
        if (target === "paper") {
          store.setPapers(store.papers.filter((paper) => paper.id !== createdEntityId));
        } else if (target === "task") {
          store.setTasks(store.tasks.filter((task) => task.id !== createdEntityId));
        } else {
          store.setNotes(store.notes.filter((note) => note.id !== createdEntityId));
        }
      }

      const { data, error: restoreError } = await supabase
        .from("feed_items")
        .update({ status: previousItem.status })
        .eq("id", itemId)
        .eq("user_id", userId)
        .select("*")
        .single();

      const restored = (data as FeedItem | null) ?? {
        ...previousItem,
        updated_at: new Date().toISOString(),
      };
      if (restoreError) {
        logger.error("Failed to restore feed item after undo", restoreError);
      }
      setKeptTriaged((current) => current.filter((item) => item.id !== itemId));
      setBaseItems((current) => {
        const merged = current.some((item) => item.id === restored.id)
          ? current.map((item) => (item.id === restored.id ? restored : item))
          : [restored, ...current];
        const visible = merged.filter((item) => feedItemMatchesFilters(item, type, status));
        if (previousItem.status === "triaged" && status === "new") {
          setKeptTriaged((kept) =>
            kept.some((item) => item.id === restored.id) ? kept : [restored, ...kept].slice(0, 20),
          );
          return sortFeedItems(visible);
        }
        return sortFeedItems(visible);
      });
      toast.success("Promote undone");
    },
    [status, type, userId],
  );

  const announcePromoteSuccess = useCallback(
    (params: {
      item: FeedItem;
      previousItem: FeedItem;
      target: FeedPromoteTarget;
      createdEntityId: string | null;
      deleteCreatedEntity: boolean;
    }) => {
      const { item, previousItem, target, createdEntityId, deleteCreatedEntity } = params;
      setBaseItems((current) =>
        sortFeedItems(
          current
            .map((currentItem) => (currentItem.id === item.id ? item : currentItem))
            .filter((currentItem) => feedItemMatchesFilters(currentItem, type, status)),
        ),
      );
      setKeptTriaged((current) => current.filter((kept) => kept.id !== item.id));
      toast.success(`Promoted to ${target}`, {
        action: createdEntityId
          ? {
              label: PROMOTE_VIEW_LABEL[target],
              onClick: () => navigateToPromotedEntity(target, createdEntityId),
            }
          : undefined,
        cancel: {
          label: "Undo",
          onClick: () => {
            void undoPromote({
              itemId: item.id,
              previousItem,
              createdEntityId,
              target,
              deleteCreatedEntity,
            });
          },
        },
      });
    },
    [status, type, undoPromote],
  );

  const promoteFeedItemLocal = useCallback(
    async (item: FeedItem, target: FeedPromoteTarget) => {
      if (!userId) return null;
      const store = useAppStore.getState();

      if (target === "paper") {
        const payload = item.payload ?? {};
        const authors = Array.isArray(payload.authors)
          ? (payload.authors as unknown[]).map(String)
          : [];
        const { data, error: insertError } = await supabase
          .from("papers")
          .insert({
            user_id: userId,
            title: item.title,
            authors,
            abstract: item.summary ?? null,
            source_url: item.url ?? null,
            status: "To Read",
          })
          .select()
          .single();
        if (insertError || !data) {
          logger.error("Failed to promote feed item locally", insertError);
          return null;
        }
        const paper = data as Paper;
        store.setPapers([paper, ...store.papers]);
        return paper.id;
      }

      if (target === "task") {
        const { data, error: insertError } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            title: item.title,
            description: item.summary ?? null,
            priority: "medium",
            category: "Research",
            completed: false,
          })
          .select()
          .single();
        if (insertError || !data) {
          logger.error("Failed to promote feed item locally", insertError);
          return null;
        }
        const task = data as Task;
        store.setTasks([task, ...store.tasks]);
        return task.id;
      }

      const { data, error: insertError } = await supabase
        .from("notes")
        .insert({
          user_id: userId,
          title: item.title,
          markdown_body: item.summary ? `${item.summary}\n\nSource: ${item.url ?? item.title}` : `Source: ${item.url ?? item.title}`,
          tags: ["feed"],
        })
        .select()
        .single();
      if (insertError || !data) {
        logger.error("Failed to promote feed item locally", insertError);
        return null;
      }
      const note = data as Note;
      store.setNotes([note, ...store.notes]);
      return note.id;
    },
    [userId],
  );

  const promoteFeedItem = useCallback(
    async (itemId: string, target: FeedPromoteTarget) => {
      if (!userId) {
        toast.error("You must be logged in to promote feeds");
        return null;
      }

      const previousItem = [...baseItems, ...keptTriaged].find((item) => item.id === itemId);
      if (!previousItem) {
        toast.error("Feed item not found");
        return null;
      }

      setBusyAction({ itemId, action: "promote" });

      try {
        // Demo-safe path (item 66): create the entity locally and mark the
        // feed item promoted — no API session required.
        if (isDemoMode()) {
          const createdEntityId = await promoteFeedItemLocal(previousItem, target);
          if (!createdEntityId) {
            toast.error("Failed to promote feed item");
            setError("Failed to promote feed item");
            return null;
          }
          const { data, error: statusError } = await supabase
            .from("feed_items")
            .update({ status: "promoted" })
            .eq("id", itemId)
            .eq("user_id", userId)
            .select("*")
            .single();
          if (statusError || !data) {
            logger.error("Failed to mark feed item promoted", statusError);
            toast.error("Created, but failed to update the feed item");
            setError("Failed to promote feed item");
            return null;
          }
          const promoted = data as FeedItem;
          announcePromoteSuccess({
            item: promoted,
            previousItem,
            target,
            createdEntityId,
            deleteCreatedEntity: true,
          });
          return { target, entity: { id: createdEntityId }, item: promoted } as PromoteResponse;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          toast.error("Your session expired. Please sign in again.");
          return null;
        }

        const response = await fetch(
          `${getApiBaseUrl()}/feed-items/${encodeURIComponent(itemId)}/promote`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ target }),
          },
        );
        const body = await response.json();

        if (!response.ok) {
          const message = extractApiErrorMessage(body, "Failed to promote feed item");
          toast.error(message);
          setError(message);
          return null;
        }

        const promoted = body as PromoteResponse;
        announcePromoteSuccess({
          item: promoted.item,
          previousItem,
          target: promoted.target,
          createdEntityId: extractEntityId(promoted.entity),
          deleteCreatedEntity: false,
        });
        return promoted;
      } catch (promoteError) {
        logger.error("Failed to promote feed item", promoteError);
        toast.error("Failed to promote feed item");
        setError("Failed to promote feed item");
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [announcePromoteSuccess, baseItems, keptTriaged, promoteFeedItemLocal, userId],
  );

  return {
    items,
    loading,
    error,
    actionItemId: busyAction?.itemId ?? null,
    busyAction,
    refreshFeedItems: fetchFeedItems,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  };
}
