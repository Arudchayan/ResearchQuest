import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useDataSync } from "../../hooks/useDataSync";
import { useAppStore } from "../../store/appStore";
import { mockSupabaseClient } from "../mocks/supabase";

function queryResult<T>(result: { data: T[] | null; error: { message: string } | null }) {
  const builder: any = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.gte = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.then = (onFulfilled?: (value: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return builder;
}

describe("useDataSync sync errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      notes: [],
      papers: [],
      ideas: [],
      notesLoading: false,
      papersLoading: false,
      ideasLoading: false,
      dataSyncErrors: {
        notes: null,
        papers: null,
        ideas: null,
      },
    });
  });

  test("stores fetch failures for notes, papers, and ideas", async () => {
    mockSupabaseClient.from.mockImplementation((table: string) =>
      queryResult({
        data: null,
        error: { message: `${table} unavailable` },
      }),
    );

    renderHook(() => useDataSync("user-1", "dashboard"));

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors).toEqual({
        notes: {
          message: "notes unavailable",
          resource: "notes",
        },
        papers: {
          message: "papers unavailable",
          resource: "papers",
        },
        ideas: {
          message: "ideas unavailable",
          resource: "ideas",
        },
      });
    });

    expect(useAppStore.getState().notesLoading).toBe(false);
    expect(useAppStore.getState().papersLoading).toBe(false);
    expect(useAppStore.getState().ideasLoading).toBe(false);
  });

  test("clears stale sync errors after successful fetches", async () => {
    useAppStore.getState().setDataSyncError("notes", "Previous notes failure");
    useAppStore.getState().setDataSyncError("papers", "Previous papers failure");
    useAppStore.getState().setDataSyncError("ideas", "Previous ideas failure");

    mockSupabaseClient.from.mockImplementation(() =>
      queryResult({
        data: [],
        error: null,
      }),
    );

    renderHook(() => useDataSync("user-1", "dashboard"));

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors).toEqual({
        notes: null,
        papers: null,
        ideas: null,
      });
    });
  });

  test("retryDataSync clears the error and refetches the resource", async () => {
    const recoveredNote = {
      id: "note-1",
      user_id: "user-1",
      title: "Recovered",
      markdown_body: "body",
      tags: [],
      linked_entity_ids: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    // First fetch fails for all resources
    mockSupabaseClient.from.mockImplementation((table: string) =>
      queryResult({
        data: null,
        error: { message: `${table} unavailable` },
      }),
    );

    renderHook(() => useDataSync("user-1", "dashboard"));

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors.notes).not.toBeNull();
    });

    // Backend recovers; the retry signal must issue a fresh notes fetch
    mockSupabaseClient.from.mockImplementation((table: string) =>
      queryResult({
        data: table === "notes" ? [recoveredNote] : [],
        error: null,
      }),
    );

    act(() => {
      useAppStore.getState().retryDataSync("notes");
    });

    await waitFor(() => {
      expect(useAppStore.getState().notes).toEqual([recoveredNote]);
    });
    expect(useAppStore.getState().dataSyncErrors.notes).toBeNull();
  });
});
