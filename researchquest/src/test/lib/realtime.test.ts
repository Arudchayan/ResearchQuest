import { beforeEach, describe, expect, test, vi } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";
import { subscribeTable } from "../../lib/realtime";

describe("subscribeTable (item 35 shared realtime primitive)", () => {
  const unsubscribeFns: Array<ReturnType<typeof vi.fn>> = [];
  let handlers: Array<(payload: unknown) => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribeFns.length = 0;
    handlers = [];
    mockSupabaseClient.channel.mockImplementation((_channelName: string) => {
      const channel: Record<string, unknown> = {};
      channel.on = vi.fn((_event: string, _params: unknown, cb: unknown) => {
        handlers.push(cb as (payload: unknown) => void);
        return channel;
      });
      channel.subscribe = vi.fn(() => {
        const unsubscribe = vi.fn();
        unsubscribeFns.push(unsubscribe);
        return { unsubscribe };
      });
      return channel;
    });
  });

  function lastOnMock() {
    const results = mockSupabaseClient.channel.mock.results;
    return (
      results[results.length - 1].value as {
        on: ReturnType<typeof vi.fn>;
      }
    ).on;
  }

  test("creates one channel per table+user with a user filter", () => {
    const release = subscribeTable("tasks", "user-1", {});
    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
      "tasks_realtime_user-1",
    );
    const onMock = lastOnMock();
    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock.mock.calls[0][1]).toMatchObject({
      event: "*",
      schema: "public",
      table: "tasks",
      filter: "user_id=eq.user-1",
    });
    release();
  });

  test("shares one channel across mounts; unsubscribes on last release only", () => {
    const first = subscribeTable("tasks", "user-share", {});
    const second = subscribeTable("tasks", "user-share", {});

    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

    first();
    expect(unsubscribeFns).toHaveLength(1);
    expect(unsubscribeFns[0]).not.toHaveBeenCalled();

    second();
    expect(unsubscribeFns[0]).toHaveBeenCalledTimes(1);
  });

  test("double release is safe (unsubscribes at most once)", () => {
    const release = subscribeTable("notes", "user-2", {});
    release();
    release();
    expect(unsubscribeFns[0]).toHaveBeenCalledTimes(1);
  });

  test("different users get isolated channels", () => {
    const releaseA = subscribeTable("tasks", "user-a", {});
    const releaseB = subscribeTable("tasks", "user-b", {});
    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2);
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
      "tasks_realtime_user-a",
    );
    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
      "tasks_realtime_user-b",
    );
    releaseA();
    releaseB();
    expect(unsubscribeFns[0]).toHaveBeenCalledTimes(1);
    expect(unsubscribeFns[1]).toHaveBeenCalledTimes(1);
  });

  test("dispatches INSERT/UPDATE/DELETE payloads to callbacks", () => {
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const release = subscribeTable<{ id: string }>("papers", "user-3", {
      onInsert,
      onUpdate,
      onDelete,
    });

    expect(handlers).toHaveLength(1);
    const emit = handlers[0];
    emit({ eventType: "INSERT", new: { id: "p1" }, old: null });
    emit({ eventType: "UPDATE", new: { id: "p1" }, old: { id: "p1" } });
    emit({ eventType: "DELETE", new: null, old: { id: "p1" } });
    // DELETE without a string id is ignored, never crashes
    emit({ eventType: "DELETE", new: null, old: {} });

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith({ id: "p1" });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("p1");
    release();
  });

  test("supports event-filtered subscriptions (focus INSERT-only)", () => {
    const release = subscribeTable("focus_sessions", "user-4", {
      event: "INSERT",
    });
    const onMock = lastOnMock();
    expect(onMock.mock.calls[0][1]).toMatchObject({
      event: "INSERT",
      table: "focus_sessions",
    });
    release();
  });
});
