import { create } from "zustand";
import type { TopicWithCounts } from "../types/database";
import { sortByUpdatedAt } from "../utils/sort";

/**
 * Topics slice: the canonical topics list, owned solely by useTopics.
 *
 * The collection is an ARRAY (newest `updated_at` first), sorted at write
 * time by the shared `sortByUpdatedAt` authority — the same order the
 * previous `Record<string, TopicWithCounts>` + read-time `Object.values`
 * conversion produced. Readers consume the array directly; use
 * `getTopicById` for by-id lookup instead of indexing.
 */
export interface TopicsSlice {
  topics: TopicWithCounts[];
  setTopics: (topics: TopicWithCounts[]) => void;
  upsertTopic: (topic: TopicWithCounts) => void;
  removeTopic: (topicId: string) => void;
  /** By-id lookup helper (replaces `topics[id]` indexing into the old Record). */
  getTopicById: (topicId: string) => TopicWithCounts | undefined;

  selectedTopic: TopicWithCounts | null;
  setSelectedTopic: (topic: TopicWithCounts | null) => void;

  topicsLoading: boolean;
  setTopicsLoading: (loading: boolean) => void;
}

export const useTopicsStore = create<TopicsSlice>()((set, get) => ({
  topics: [],
  setTopics: (topics) => set({ topics: sortByUpdatedAt(topics) }),
  upsertTopic: (topic) =>
    set((state) => ({
      topics: sortByUpdatedAt([
        topic,
        ...state.topics.filter((t) => t.id !== topic.id),
      ]),
    })),
  removeTopic: (topicId) =>
    set((state) => ({
      topics: state.topics.filter((t) => t.id !== topicId),
    })),
  getTopicById: (topicId) => get().topics.find((t) => t.id === topicId),

  selectedTopic: null,
  setSelectedTopic: (selectedTopic) => set({ selectedTopic }),

  topicsLoading: false,
  setTopicsLoading: (topicsLoading) => set({ topicsLoading }),
}));
