import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Schema-light Areas/Subjects: a kind on an existing topic, no new table. */
export type TopicKind = "research" | "area" | "subject";

export const TOPIC_KINDS: TopicKind[] = ["research", "area", "subject"];

export const TOPIC_KIND_LABELS: Record<TopicKind, string> = {
  research: "Research",
  area: "Area",
  subject: "Subject",
};

export interface TopicKindState {
  kinds: Record<string, TopicKind>;
  setKind: (id: string, kind: TopicKind) => void;
  kindOf: (id: string) => TopicKind;
  /** Drop all assignments — wire to sign-out if a logout flow is added
   * (device-scoped like todayPlanStore; no logout exists yet). */
  clearKinds: () => void;
}

export const useTopicKindStore = create<TopicKindState>()(
  persist(
    (set, get) => ({
      kinds: {},
      setKind: (id, kind) =>
        set((state) => ({ kinds: { ...state.kinds, [id]: kind } })),
      kindOf: (id) => get().kinds[id] ?? "research",
      clearKinds: () => set({ kinds: {} }),
    }),
    { name: "researchquest-topic-kinds" },
  ),
);
