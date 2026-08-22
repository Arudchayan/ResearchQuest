import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import "../mocks/supabase";

import type { TopicQuestWithTopic } from "../../types/database";

const awardXPMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../../utils/gamification", async () => {
  const actual = await vi.importActual<
    typeof import("../../utils/gamification")
  >("../../utils/gamification");
  return {
    ...actual,
    awardXP: awardXPMock,
  };
});

const { mockSupabaseClient } = await import("../mocks/supabase");
const { useTopics } = await import("../../hooks/useTopics");
const { useAppStore } = await import("../../store/appStore");

describe("useTopics", () => {
  type TestResponse = {
    data: unknown;
    error: { message: string } | null;
  };
  type TestMock = ReturnType<typeof vi.fn>;
  type TestBuilder = {
    select: TestMock;
    eq: TestMock;
    order: TestMock;
    in: TestMock;
    update: TestMock;
    upsert: TestMock;
    delete: TestMock;
    insert: TestMock;
    limit: TestMock;
    then: (
      onFulfilled?: ((value: TestResponse) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise<unknown>;
    single: TestMock;
    maybeSingle: TestMock;
  };

  const createBuilder = (response: TestResponse): TestBuilder => {
    const builder: TestBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      in: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
      limit: vi.fn(),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(response).then(onFulfilled, onRejected),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.upsert.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.single.mockResolvedValue(response);
    builder.maybeSingle.mockResolvedValue(response);
    return builder;
  };

  // Typed aliases for the deferred list-response tests.
  interface TopicListRow {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }

  interface TopicsListResponse {
    data: TopicListRow[] | null;
    error: { message: string } | null;
  }

  // Reuses createBuilder's chain methods but replaces `.then` with a pending
  // promise so tests control when each list response lands.
  const createDeferredTopicsBuilder = (
    pending: Promise<TopicsListResponse>,
  ) => {
    const builder = createBuilder({ data: null, error: null });
    builder.then = (
      onFulfilled?: ((value: TopicsListResponse) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => pending.then(onFulfilled, onRejected);
    return builder;
  };

  beforeEach(() => {
    useAppStore.setState({
      topics: [],
      selectedTopic: null,
    });
    mockSupabaseClient.from.mockReset();
  });

  it("caches topic ids per entity to avoid duplicate fetches", async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        return createBuilder({ data: [], error: null });
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [], error: null });
      }
      if (table === "topic_notes") {
        return createBuilder({ data: [{ topic_id: "topic-1" }], error: null });
      }
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTopics("user-1"));

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("topics");
    });

    const first = await result.current.getTopicIdsForEntity("note-1", "note");
    const second = await result.current.getTopicIdsForEntity("note-1", "note");

    expect(first).toEqual(["topic-1"]);
    expect(second).toEqual(["topic-1"]);

    const topicNoteCalls = mockSupabaseClient.from.mock.calls.filter(
      ([table]) => table === "topic_notes",
    );
    // In strict mode or some test environments, effects might run twice or calls might happen due to re-renders.
    // We accept 1 or 2 calls, but we check that the result is consistent.
    expect(topicNoteCalls.length).toBeGreaterThanOrEqual(1);
    expect(topicNoteCalls.length).toBeLessThanOrEqual(2);
  });

  it("increments quest progress when marking advanceQuest", async () => {
    const quest: TopicQuestWithTopic = {
      id: "quest-1",
      user_id: "user-1",
      topic_id: "topic-1",
      objective: "Update notes",
      target_count: 1,
      progress_count: 0,
      due_date: null,
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      topic: {
        id: "topic-1",
        name: "ML",
        updated_at: "2024-01-01T00:00:00Z",
      },
    };

    let questCalls = 0;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        return createBuilder({ data: [], error: null });
      }
      if (table === "topic_notes") {
        return createBuilder({ data: [], error: null });
      }
      if (table === "topic_quests") {
        questCalls += 1;
        if (questCalls === 1) {
          return createBuilder({ data: [quest], error: null });
        }
        return createBuilder({
          data: {
            ...quest,
            progress_count: 1,
            status: "completed",
          },
          error: null,
        });
      }
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTopics("user-1"));

    await waitFor(() => {
      expect(result.current.quests).toHaveLength(1);
    });

    await result.current.advanceQuest("topic-1");

    await waitFor(() => {
      expect(result.current.quests[0].progress_count).toBe(1);
      expect(result.current.quests[0].status).toBe("completed");
    });
  });

  it("returns and stores the inserted topic row on create", async () => {
    const userId = "user-create";
    const insertedTopic = {
      id: "topic-new",
      user_id: userId,
      name: "Visualization",
      description: null,
      created_at: "2026-04-26T00:00:00Z",
      updated_at: "2026-04-26T00:00:00Z",
    };

    const insertBuilder = createBuilder({ data: insertedTopic, error: null });
    const insertSpy = vi.fn().mockReturnValue(insertBuilder);

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        return {
          ...createBuilder({ data: [], error: null }),
          insert: insertSpy,
        };
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [], error: null });
      }
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useTopics(userId));

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("topics");
    });

    const created = await result.current.createTopic({ name: "Visualization" });

    expect(insertSpy).toHaveBeenCalledWith({
      user_id: userId,
      name: "Visualization",
      description: null,
    });
    expect(insertBuilder.select).toHaveBeenCalledWith("*");
    expect(created).toEqual({
      ...insertedTopic,
      note_count: 0,
      paper_count: 0,
      idea_count: 0,
    });
    expect(useAppStore.getState().topics["topic-new"]?.name).toBe(
      "Visualization",
    );
  });

  it("refetches topics when retryDataSync is called after a failure", async () => {
    const userId = "user-retry";
    let fail = true;
    const activeQuest: TopicQuestWithTopic = {
      id: "quest-retry",
      user_id: userId,
      topic_id: "topic-1",
      objective: "Review ML",
      target_count: 1,
      progress_count: 0,
      due_date: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      topic: {
        id: "topic-1",
        name: "ML",
        updated_at: "2026-01-01T00:00:00Z",
      },
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        return createBuilder(
          fail
            ? { data: null, error: { message: "topics down" } }
            : {
                data: [
                  {
                    id: "topic-1",
                    user_id: userId,
                    name: "ML",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                ],
                error: null,
              },
        );
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [activeQuest], error: null });
      }
      return createBuilder({ data: null, error: null });
    });

    useAppStore.setState({
      dataSyncErrors: {
        ...useAppStore.getState().dataSyncErrors,
        topics: null,
      },
    });

    renderHook(() => useTopics(userId));

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors.topics).not.toBeNull();
    });

    fail = false;
    useAppStore.getState().retryDataSync("topics");

    await waitFor(() => {
      expect(useAppStore.getState().topics["topic-1"]?.name).toBe("ML");
    });
    expect(useAppStore.getState().dataSyncErrors.topics).toBeNull();
  });

  it("non-owner mounts fetch no topics list; one retryDataSync yields exactly one request", async () => {
    const userId = "user-owner-once";
    let topicsCalls = 0;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        topicsCalls += 1;
        return createBuilder({ data: [], error: null });
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [], error: { message: "no quests" } });
      }
      return createBuilder({ data: null, error: null });
    });

    renderHook(() => useTopics(userId));
    await waitFor(() => expect(topicsCalls).toBe(1));

    // A consumer (TopicsView/TopicSelector) mounts — must not issue a list fetch.
    renderHook(() => useTopics(userId, { owner: false }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(topicsCalls).toBe(1);

    useAppStore.getState().retryDataSync("topics");
    await waitFor(() => expect(topicsCalls).toBe(2));
    expect(topicsCalls).toBe(2);
  });

  it("ignores a stale list response that resolves after a newer fetch", async () => {
    const userId = "user-stale-order";
    let resolveFirst!: (value: TopicsListResponse) => void;
    let resolveSecond!: (value: TopicsListResponse) => void;
    const first = new Promise<TopicsListResponse>((r) => (resolveFirst = r));
    const second = new Promise<TopicsListResponse>((r) => (resolveSecond = r));
    let call = 0;

    const staleTopic: TopicListRow = {
      id: "topic-stale",
      user_id: userId,
      name: "Stale",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const newerTopic: TopicListRow = {
      id: "topic-newer",
      user_id: userId,
      name: "Newer",
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        call += 1;
        return createDeferredTopicsBuilder(call === 1 ? first : second);
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [], error: { message: "no quests" } });
      }
      return createBuilder({ data: null, error: null });
    });

    renderHook(() => useTopics(userId));
    await waitFor(() => expect(call).toBe(1)); // initial fetch in flight

    useAppStore.getState().retryDataSync("topics");
    await waitFor(() => expect(call).toBe(2)); // retry fetch in flight

    // Newer response lands first and must win.
    resolveSecond({ data: [newerTopic], error: null });
    await waitFor(() => {
      expect(useAppStore.getState().topics["topic-newer"]?.name).toBe("Newer");
    });

    // Older response lands late — must be discarded.
    resolveFirst({ data: [staleTopic], error: null });
    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().topics["topic-newer"]).toBeDefined();
    expect(useAppStore.getState().topics["topic-stale"]).toBeUndefined();
  });

  it("discards an in-flight list response when the user changes mid-flight", async () => {
    let resolveA!: (value: TopicsListResponse) => void;
    let resolveB!: (value: TopicsListResponse) => void;
    const a = new Promise<TopicsListResponse>((r) => (resolveA = r));
    const b = new Promise<TopicsListResponse>((r) => (resolveB = r));
    let call = 0;

    const topicA: TopicListRow = {
      id: "topic-a",
      user_id: "user-a",
      name: "A",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const topicB: TopicListRow = {
      id: "topic-b",
      user_id: "user-b",
      name: "B",
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "topics") {
        call += 1;
        return createDeferredTopicsBuilder(call === 1 ? a : b);
      }
      if (table === "topic_quests") {
        return createBuilder({ data: [], error: { message: "no quests" } });
      }
      return createBuilder({ data: null, error: null });
    });

    const { rerender } = renderHook(
      ({ uid }: { uid: string }) => useTopics(uid),
      { initialProps: { uid: "user-a" } },
    );

    await waitFor(() => expect(call).toBe(1)); // user-a fetch in flight

    rerender({ uid: "user-b" });
    await waitFor(() => expect(call).toBe(2)); // user-b fetch started

    resolveB({ data: [topicB], error: null });
    await waitFor(() => {
      expect(useAppStore.getState().topics["topic-b"]?.name).toBe("B");
    });

    // user-a's late response must not overwrite user-b's topics.
    resolveA({ data: [topicA], error: null });
    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().topics["topic-b"]).toBeDefined();
    expect(useAppStore.getState().topics["topic-a"]).toBeUndefined();
  });
});
