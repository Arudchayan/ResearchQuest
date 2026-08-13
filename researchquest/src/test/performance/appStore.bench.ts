import { describe, bench } from "vitest";
import { useAppStore } from "../../store/appStore";

describe("appStore upsertTopic", () => {
  const store = useAppStore.getState();

  // Setup 10,000 topics
  const topics = Array.from({ length: 10000 }).map((_, i) => ({
    id: `topic-${i}`,
    user_id: "user-1",
    name: `Topic ${i}`,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_count: 0,
    paper_count: 0,
    idea_count: 0,
  }));

  store.setTopics(topics);

  const topicToUpsert = {
    id: `topic-9999`, // Last item to force worst-case findIndex
    user_id: "user-1",
    name: `Topic 9999 Updated`,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_count: 1,
    paper_count: 0,
    idea_count: 0,
  };

  const newTopic = {
    id: `topic-10000`, // Not in list
    user_id: "user-1",
    name: `New Topic`,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    note_count: 1,
    paper_count: 0,
    idea_count: 0,
  };

  bench("upsert existing topic", () => {
    store.upsertTopic(topicToUpsert);
  });

  bench("upsert new topic", () => {
    store.upsertTopic(newTopic);
  });
});
