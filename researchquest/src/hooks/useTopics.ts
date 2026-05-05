import { logger } from "../utils/logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { awardXP, XP_REWARDS } from "../utils/gamification";
import type {
  TopicWithCounts,
  TopicEntityType,
  TopicQuestWithTopic,
} from "../types/database";
import type { PostgrestError } from "@supabase/supabase-js";
import { useShallow } from "zustand/react/shallow";

interface TopicRow extends TopicWithCounts {
  topic_notes?: { count: number | null }[];
  topic_papers?: { count: number | null }[];
  topic_ideas?: { count: number | null }[];
}

interface TopicQuestRow extends TopicQuestWithTopic {
  topics?: {
    id: string;
    name: string;
    updated_at: string;
  };
}

const TOPIC_SELECT =
  "*, topic_notes(count), topic_papers(count), topic_ideas(count)";

const ENTITY_TABLE: Record<TopicEntityType, string> = {
  note: "topic_notes",
  paper: "topic_papers",
  idea: "topic_ideas",
};

const ENTITY_COLUMN: Record<TopicEntityType, string> = {
  note: "note_id",
  paper: "paper_id",
  idea: "idea_id",
};

// Global caches to persist across hook instances/remounts
const globalLinkCache = new Map<string, string[]>();
const tableSupportCache = new Map<string, Promise<boolean>>();
const fetchedUsers = new Set<string>();

function tableSupportsUserId(table: string): Promise<boolean> {
  let promise = tableSupportCache.get(table);
  if (!promise) {
    promise = (async () => {
      const { error } = await supabase.from(table).select("user_id").limit(1);

      let supported = true;
      if (error) {
        const normalized =
          `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
        if (normalized.includes("column") && normalized.includes("user_id")) {
          supported = false;
        }
      }
      return supported;
    })();
    tableSupportCache.set(table, promise);
  }
  return promise;
}

function coerceCount(value?: { count: number | null }[]): number {
  if (!value || value.length === 0) return 0;
  const first = value[0];
  if (!first || first.count == null) return 0;
  return first.count;
}

function mapTopicRow(row: TopicRow): TopicWithCounts {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_count: coerceCount(row.topic_notes),
    paper_count: coerceCount(row.topic_papers),
    idea_count: coerceCount(row.topic_ideas),
  };
}

function isTopicRow(value: unknown): value is TopicRow {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.user_id === "string" &&
    typeof record.name === "string" &&
    typeof record.created_at === "string" &&
    typeof record.updated_at === "string"
  );
}

function isTopicRowArray(value: unknown): value is TopicRow[] {
  return Array.isArray(value) && value.every(isTopicRow);
}

function mapQuestRow(row: TopicQuestRow): TopicQuestWithTopic {
  return {
    id: row.id,
    user_id: row.user_id,
    topic_id: row.topic_id,
    objective: row.objective,
    target_count: row.target_count,
    progress_count: row.progress_count,
    due_date: row.due_date,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    topic: row.topics
      ? {
          id: row.topics.id,
          name: row.topics.name,
          updated_at: row.topics.updated_at,
        }
      : row.topic,
  };
}

function getDueDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
}

export function useTopics(userId: string | undefined) {
  const { topicsRecord, setTopics, upsertTopic, removeTopic, setSelectedTopic, setTopicsLoading, setDataSyncError } =
    useAppStore(
      useShallow((state) => ({
        topicsRecord: state.topics,
        setTopics: state.setTopics,
        upsertTopic: state.upsertTopic,
        removeTopic: state.removeTopic,
        setSelectedTopic: state.setSelectedTopic,
        setTopicsLoading: state.setTopicsLoading,
        setDataSyncError: state.setDataSyncError,
      })),
    );

  const topics = useMemo(() => {
    return Object.values(topicsRecord).sort((a, b) =>
      a.updated_at > b.updated_at ? -1 : a.updated_at < b.updated_at ? 1 : 0
    );
  }, [topicsRecord]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quests, setQuests] = useState<TopicQuestWithTopic[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);

  const supportsCountsRef = useRef(true);
  const linkSupportsUserIdRef = useRef<Record<TopicEntityType, boolean>>({
    note: false,
    paper: true,
    idea: true,
  });

  const isRelationshipError = useCallback((err: PostgrestError | null) => {
    if (!err) return false;
    const match = err.message
      ?.toLowerCase()
      .includes("could not find a relationship");
    if (match) {
      supportsCountsRef.current = false;
    }
    return Boolean(match);
  }, []);

  const fetchTopics = useCallback(
    async (force = false) => {
      if (!userId) {
        setTopics([]);
        setLoading(false);
        setTopicsLoading(false);
        return;
      }

      // Optimization: Check if topics are already loaded
      const currentTopics = Object.values(useAppStore.getState().topics);
      if (!force) {
        // If we have fetched for this user before, skip (handles empty state)
        // Or if store has topics for this user (handles persistence)
        if (
          fetchedUsers.has(userId) ||
          (currentTopics.length > 0 && currentTopics[0]?.user_id === userId)
        ) {
          setLoading(false);
          setTopicsLoading(false);
          return;
        }
      }

      setLoading(true);
      setTopicsLoading(true);
      const selectColumns = supportsCountsRef.current ? TOPIC_SELECT : "*";
      let { data, error: fetchError } = await supabase
        .from("topics")
        .select(selectColumns)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (fetchError && isRelationshipError(fetchError)) {
        const fallback = await supabase
          .from("topics")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        data = fallback.data;
        fetchError = fallback.error;
      }

      if (fetchError) {
        logger.error(
          "Failed to fetch topics:",
          fetchError.message || "Unknown error",
        );
        setError(fetchError.message);
        setDataSyncError("topics", fetchError.message);
      } else if (isTopicRowArray(data)) {
        const rows: TopicRow[] = data;
        const mapped = rows.map((row) => mapTopicRow(row));
        setTopics(mapped);
        fetchedUsers.add(userId);
        setError(null);
      } else {
        setTopics([]);
        fetchedUsers.add(userId);
        setError(null);
      }

      setLoading(false);
      setTopicsLoading(false);
    },
    [isRelationshipError, setTopics, setTopicsLoading, setDataSyncError, userId],
  );

  const fetchTopicById = useCallback(
    async (topicId: string) => {
      if (!userId) return;

      const selectColumns = supportsCountsRef.current ? TOPIC_SELECT : "*";
      let { data, error: fetchError } = await supabase
        .from("topics")
        .select(selectColumns)
        .eq("user_id", userId)
        .eq("id", topicId)
        .maybeSingle();

      if (fetchError && isRelationshipError(fetchError)) {
        const fallback = await supabase
          .from("topics")
          .select("*")
          .eq("user_id", userId)
          .eq("id", topicId)
          .maybeSingle();
        data = fallback.data;
        fetchError = fallback.error;
      }

      if (fetchError) {
        logger.error(
          "Failed to refresh topic:",
          fetchError.message || "Unknown error",
        );
        return;
      }

      if (data && isTopicRow(data)) {
        const mapped = mapTopicRow(data);
        upsertTopic(mapped);
        const currentSelected = useAppStore.getState().selectedTopic;
        if (currentSelected?.id === mapped.id) {
          setSelectedTopic(mapped);
        }
      }
    },
    [isRelationshipError, setSelectedTopic, upsertTopic, userId],
  );

  const fetchQuests = useCallback(async () => {
    if (!userId) {
      setQuests([]);
      return;
    }
    setQuestsLoading(true);
    const { data, error: questError } = await supabase
      .from("topic_quests")
      .select("*, topics(id, name, updated_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (questError) {
      logger.error(
        "Failed to fetch topic quests:",
        questError.message || "Unknown error",
      );
    } else {
      const questRows = (data || []).map((row) =>
        mapQuestRow(row as TopicQuestRow),
      );
      setQuests(questRows);
    }
    setQuestsLoading(false);
  }, [userId]);

  const ensureActiveQuest = useCallback(async () => {
    if (!userId || topics.length === 0) return;
    const existingActive = quests.find((quest) => quest.status === "active");
    if (existingActive) return;

    const sortedTopics = [...topics].sort((a, b) =>
      // Optimization: Use direct string comparison for ISO dates
      a.updated_at > b.updated_at ? 1 : a.updated_at < b.updated_at ? -1 : 0
    );
    const targetTopic = sortedTopics[0];
    const objective = `Review and enrich "${targetTopic.name}"`;
    const { data, error: insertError } = await supabase
      .from("topic_quests")
      .insert({
        user_id: userId,
        topic_id: targetTopic.id,
        objective,
        target_count: 1,
        due_date: getDueDate(3),
      })
      .select("*, topics(id, name, updated_at)")
      .single();

    if (insertError) {
      logger.error(
        "Failed to create topic quest:",
        insertError.message || "Unknown error",
      );
      return;
    }

    if (data) {
      const quest = mapQuestRow(data as TopicQuestRow);
      setQuests((prev) => [quest, ...prev]);
    }
  }, [quests, topics, userId]);

  useEffect(() => {
    if (!userId) {
      linkSupportsUserIdRef.current = { note: false, paper: true, idea: true };
      return;
    }

    let cancelled = false;

    const detect = async () => {
      const entries = await Promise.all(
        (["note", "paper", "idea"] as const).map(async (type) => {
          const table = ENTITY_TABLE[type];
          try {
            const supports = await tableSupportsUserId(table);
            return { type, supports };
          } catch (error) {
            logger.error(
              `Failed to detect user_id support for ${table}`,
              (error as Error).message || error,
            );
            return { type, supports: linkSupportsUserIdRef.current[type] };
          }
        }),
      );

      if (cancelled) return;

      entries.forEach(({ type, supports }) => {
        linkSupportsUserIdRef.current[type] = supports;
      });
    };

    void detect();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    void fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    void fetchQuests();
  }, [fetchQuests]);

  useEffect(() => {
    void ensureActiveQuest();
  }, [ensureActiveQuest]);

  const createTopic = useCallback(
    async (topicData: { name: string; description?: string }) => {
      if (!userId) {
        toast.error("You must be logged in to create topics");
        return null;
      }

      if (topicData.name.length > 50) {
        toast.error("Topic name is too long");
        return null;
      }

      if (topicData.description && topicData.description.length > 500) {
        toast.error("Topic description is too long");
        return null;
      }

      const payload = {
        user_id: userId,
        name: topicData.name.trim(),
        description: topicData.description?.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from("topics")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        logger.error(
          "Failed to create topic:",
          insertError.message || "Unknown error",
        );
        toast.error(insertError.message);
        return null;
      }

      const mapped = mapTopicRow(data as TopicRow);
      upsertTopic(mapped);
      setSelectedTopic(mapped);
      toast.success("Topic created");
      await awardXP(userId, XP_REWARDS.CREATE_TOPIC, "create_topic");
      void ensureActiveQuest();
      if (supportsCountsRef.current) {
        void fetchTopicById(mapped.id);
      }
      return mapped;
    },
    [ensureActiveQuest, fetchTopicById, setSelectedTopic, upsertTopic, userId],
  );

  const adjustCounts = useCallback(
    (topicId: string, delta: Partial<Record<TopicEntityType, number>>) => {
      const topic = useAppStore.getState().topics[topicId];
      if (!topic) return;
      const updated: TopicWithCounts = {
        ...topic,
        note_count: topic.note_count + (delta.note ?? 0),
        paper_count: topic.paper_count + (delta.paper ?? 0),
        idea_count: topic.idea_count + (delta.idea ?? 0),
      };
      upsertTopic(updated);
      const currentSelected = useAppStore.getState().selectedTopic;
      if (currentSelected?.id === topicId) {
        setSelectedTopic(updated);
      }
    },
    [setSelectedTopic, upsertTopic],
  );

  const incrementQuestProgress = useCallback(
    async (topicId: string) => {
      if (!userId) return;
      const active = quests.find(
        (quest) => quest.topic_id === topicId && quest.status === "active",
      );
      if (!active) return;
      const nextProgress = Math.min(
        active.progress_count + 1,
        active.target_count,
      );
      const nextStatus =
        nextProgress >= active.target_count ? "completed" : active.status;

      const { data, error: progressError } = await supabase
        .from("topic_quests")
        .update({
          progress_count: nextProgress,
          status: nextStatus,
        })
        .eq("id", active.id)
        .select("*, topics(id, name, updated_at)")
        .single();

      if (progressError) {
        logger.error(
          "Failed to update quest progress:",
          progressError.message || "Unknown error",
        );
        return;
      }

      if (data) {
        const quest = mapQuestRow(data as TopicQuestRow);
        setQuests((prev) => {
          const existingIndex = prev.findIndex((q) => q.id === quest.id);
          if (existingIndex === -1) {
            return [quest, ...prev];
          }
          const updated = [...prev];
          updated[existingIndex] = quest;
          return updated;
        });
        if (nextStatus === "completed") {
          await awardXP(
            userId,
            XP_REWARDS.COMPLETE_TOPIC_QUEST,
            "complete_topic_quest",
          );
          toast.success("Topic quest completed!");
        }
      }
    },
    [quests, userId],
  );

  const updateTopic = useCallback(
    async (
      topicId: string,
      updates: { name?: string; description?: string },
    ) => {
      if (!userId) {
        toast.error("You must be logged in to update topics");
        return false;
      }

      if (updates.name && updates.name.length > 50) {
        toast.error("Topic name is too long");
        return false;
      }

      if (updates.description && updates.description.length > 500) {
        toast.error("Topic description is too long");
        return false;
      }

      const payload: Record<string, unknown> = {};
      if (typeof updates.name === "string") {
        payload.name = updates.name.trim();
      }
      if (typeof updates.description === "string") {
        payload.description = updates.description.trim() || null;
      }

      const { error: updateError } = await supabase
        .from("topics")
        .update(payload)
        .eq("id", topicId)
        .eq("user_id", userId);

      if (updateError) {
        logger.error(
          "Failed to update topic:",
          updateError.message || "Unknown error",
        );
        toast.error(updateError.message);
        return false;
      }

      await fetchTopicById(topicId);
      await incrementQuestProgress(topicId);
      await awardXP(userId, XP_REWARDS.UPDATE_TOPIC, "update_topic");
      toast.success("Topic updated");
      return true;
    },
    [fetchTopicById, incrementQuestProgress, userId],
  );

  const deleteTopic = useCallback(
    async (topicId: string) => {
      if (!userId) {
        toast.error("You must be logged in to delete topics");
        return false;
      }

      const { error: deleteError } = await supabase
        .from("topics")
        .delete()
        .eq("id", topicId)
        .eq("user_id", userId);

      if (deleteError) {
        logger.error(
          "Failed to delete topic:",
          deleteError.message || "Unknown error",
        );
        toast.error(deleteError.message);
        return false;
      }

      removeTopic(topicId);

      globalLinkCache.forEach((ids, key) => {
        if (key.startsWith(userId + ":") && ids.includes(topicId)) {
          globalLinkCache.set(
            key,
            ids.filter((id) => id !== topicId),
          );
        }
      });

      const currentSelected = useAppStore.getState().selectedTopic;
      if (currentSelected?.id === topicId) {
        setSelectedTopic(null);
      }
      setQuests((prev) => prev.filter((quest) => quest.topic_id !== topicId));
      void ensureActiveQuest();
      toast.success("Topic deleted");
      return true;
    },
    [ensureActiveQuest, removeTopic, setSelectedTopic, userId],
  );

  const attachTopicToEntity = useCallback(
    async (topicId: string, entityId: string, entityType: TopicEntityType) => {
      if (!userId) {
        toast.error("You must be logged in to link topics");
        return false;
      }

      const table = ENTITY_TABLE[entityType];
      const column = ENTITY_COLUMN[entityType];
      const payload: Record<string, unknown> = {
        topic_id: topicId,
        [column]: entityId,
      };

      if (linkSupportsUserIdRef.current[entityType]) {
        payload.user_id = userId;
      }

      const { error: upsertError } = await supabase
        .from(table)
        .upsert(payload, { onConflict: `topic_id,${column}` });

      if (upsertError) {
        const normalizedMessage =
          `${upsertError.message ?? ""} ${upsertError.details ?? ""}`.toLowerCase();
        const missingUserId =
          normalizedMessage.includes("user_id") &&
          normalizedMessage.includes("does not exist");
        if (missingUserId && linkSupportsUserIdRef.current[entityType]) {
          linkSupportsUserIdRef.current[entityType] = false;
          return attachTopicToEntity(topicId, entityId, entityType);
        }
        logger.error(
          "Failed to link topic:",
          upsertError.message || "Unknown error",
        );
        toast.error(upsertError.message);
        return false;
      }

      adjustCounts(topicId, { [entityType]: 1 });

      const cacheKey = `${userId}:${entityType}:${entityId}`;
      const cached = globalLinkCache.get(cacheKey) || [];
      if (!cached.includes(topicId)) {
        globalLinkCache.set(cacheKey, [...cached, topicId]);
      }

      await incrementQuestProgress(topicId);
      await awardXP(
        userId,
        XP_REWARDS.TAG_ENTITY_WITH_TOPIC,
        "tag_entity_with_topic",
      );
      return true;
    },
    [adjustCounts, incrementQuestProgress, userId],
  );

  const detachTopicFromEntity = useCallback(
    async (topicId: string, entityId: string, entityType: TopicEntityType) => {
      if (!userId) {
        toast.error("You must be logged in to unlink topics");
        return false;
      }

      const table = ENTITY_TABLE[entityType];
      const column = ENTITY_COLUMN[entityType];

      let query = supabase
        .from(table)
        .delete()
        .eq("topic_id", topicId)
        .eq(column, entityId);

      if (linkSupportsUserIdRef.current[entityType]) {
        query = query.eq("user_id", userId);
      }

      const { error: deleteError } = await query;

      if (deleteError) {
        logger.error(
          "Failed to unlink topic:",
          deleteError.message || "Unknown error",
        );
        toast.error(deleteError.message);
        return false;
      }

      adjustCounts(topicId, { [entityType]: -1 });

      const cacheKey = `${userId}:${entityType}:${entityId}`;
      const cached = globalLinkCache.get(cacheKey);
      if (cached) {
        globalLinkCache.set(
          cacheKey,
          cached.filter((id) => id !== topicId),
        );
      }

      return true;
    },
    [adjustCounts, userId],
  );

  const getTopicIdsForEntity = useCallback(
    async (entityId: string, entityType: TopicEntityType) => {
      if (!userId) return [];

      const cacheKey = `${userId}:${entityType}:${entityId}`;
      const cached = globalLinkCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const table = ENTITY_TABLE[entityType];
      const column = ENTITY_COLUMN[entityType];
      let query = supabase.from(table).select("topic_id").eq(column, entityId);

      if (linkSupportsUserIdRef.current[entityType]) {
        query = query.eq("user_id", userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error(
          "Failed to fetch topic links:",
          fetchError.message || "Unknown error",
        );
        return [];
      }

      const topicIds = (data || []).map((row) => row.topic_id);

      // Prevent memory leaks
      if (globalLinkCache.size > 1000) {
        globalLinkCache.clear();
      }
      globalLinkCache.set(cacheKey, topicIds);
      return topicIds;
    },
    [userId],
  );

  const activeQuest = useMemo(
    () => quests.find((quest) => quest.status === "active") || null,
    [quests],
  );

  return {
    topics,
    loading,
    error,
    createTopic,
    updateTopic,
    deleteTopic,
    attachTopicToEntity,
    detachTopicFromEntity,
    getTopicIdsForEntity,
    fetchTopics,
    fetchTopicById,
    quests,
    questsLoading,
    activeQuest,
    refreshQuests: fetchQuests,
    advanceQuest: incrementQuestProgress,
  };
}
