import { renderHook, waitFor } from "@testing-library/react";
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
  builder.then = (onFulfilled?: (value: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  builder.range = vi.fn().mockReturnValue({
     then: builder.then
  });
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

  test("stores dashboard preview fetch failures for notes, papers, and ideas", async () => {
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
          message: "Failed to load notes preview.",
          resource: "notes",
        },
        papers: {
          message: "Failed to load papers preview.",
          resource: "papers",
        },
        ideas: {
          message: "Failed to load ideas preview.",
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

  test("clears stale ideas when an ideas fetch returns no rows", async () => {
    useAppStore.setState({
      ideas: [
        {
          id: "stale-idea",
          user_id: "user-1",
          title: "Stale Idea",
          description: "",
          stage: "Seed",
          linked_note_ids: [],
          linked_paper_ids: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
    });

    mockSupabaseClient.from.mockImplementation(() =>
      queryResult({
        data: [],
        error: null,
      }),
    );

    renderHook(() => useDataSync("user-1", "ideas"));

    await waitFor(() => {
      expect(useAppStore.getState().ideas).toEqual([]);
    });
  });

  test("allows retrying notes after a failed fetch", async () => {
    let notesFetches = 0;

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "notes") {
        notesFetches += 1;
        return queryResult({
          data: notesFetches === 1 ? null : [],
          error: notesFetches === 1 ? { message: "notes unavailable" } : null,
        });
      }

      return queryResult({
        data: [],
        error: null,
      });
    });

    const { rerender } = renderHook(
      ({ view }) => useDataSync("user-1", view),
      { initialProps: { view: "notes" } },
    );

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors.notes).toEqual({
        message: "Failed to load notes.",
        resource: "notes",
      });
    });
    expect(notesFetches).toBe(1);

    rerender({ view: "ideas" });
    rerender({ view: "notes" });

    await waitFor(() => {
      expect(notesFetches).toBe(2);
      expect(useAppStore.getState().dataSyncErrors.notes).toBeNull();
    });
  });
});
