import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import "../mocks/supabase";
import { mockSupabaseClient } from "../mocks/supabase";
import { getApiBaseUrl, useFeedItems } from "../../hooks/useFeedItems";
import { useFeedItemsStore } from "../../store/feedItemsStore";

describe("useFeedItems getApiBaseUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the gateway base URL and trims a trailing slash", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co/");
    expect(getApiBaseUrl()).toBe(
      "https://example.supabase.co/functions/v1/api/v1",
    );
  });

  it("throws an explicit error when VITE_SUPABASE_URL is empty", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(() => getApiBaseUrl()).toThrow("Supabase URL is not configured.");
  });

  it("throws an explicit error when VITE_SUPABASE_URL is undefined", () => {
    vi.stubEnv("VITE_SUPABASE_URL", undefined as unknown as string);
    expect(() => getApiBaseUrl()).toThrow("Supabase URL is not configured.");
  });
});

describe("useFeedItems missing-env path", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    useFeedItemsStore.setState({ items: [], loading: true, error: null });
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("promoteFeedItem fails closed without calling fetch when the URL is not configured", async () => {
    useFeedItemsStore.setState({
      items: [
        {
          id: "item-1",
          user_id: "user-1",
          type: "paper",
          title: "Seed item",
          summary: null,
          url: null,
          payload: {},
          status: "new",
          external_id: null,
          published_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      loading: false,
      error: null,
    });
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true);
    try {
      const { result } = renderHook(() => useFeedItems("user-1"));

      let promoted: unknown = "unset";
      await act(async () => {
        promoted = await result.current.promoteFeedItem("item-1", "paper");
      });

      expect(promoted).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.error).toBe("Failed to promote feed item");
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });
});
