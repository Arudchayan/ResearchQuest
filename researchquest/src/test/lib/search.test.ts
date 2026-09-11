import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SEARCH_LIMIT,
  clientSearch,
  ideaSearchText,
  noteSearchText,
  paperSearchText,
  searchIdeasViaRpc,
  searchNotesViaRpc,
  searchPapersViaRpc,
  globalSearchViaRpc,
  shouldUseServerSearch,
} from "../../lib/search";
import { mockSupabaseClient } from "../mocks/supabase";

const notes = [
  { id: "1", title: "Quantum Computing", markdown_body: "qubits and gates" },
  { id: "2", title: "Grocery list", markdown_body: "milk and eggs" },
  { id: "3", title: "QUANTUM error correction", markdown_body: "surface codes" },
];

describe("shouldUseServerSearch", () => {
  it("is false in demo mode (demoSupabase has no FTS)", () => {
    expect(shouldUseServerSearch(true, "quantum")).toBe(false);
  });
  it("is false for empty/blank queries", () => {
    expect(shouldUseServerSearch(false, "")).toBe(false);
    expect(shouldUseServerSearch(false, "   ")).toBe(false);
  });
  it("is true for live mode with a real query", () => {
    expect(shouldUseServerSearch(false, "quantum")).toBe(true);
  });
});

describe("clientSearch fallback", () => {
  it("matches case-insensitively across text fields", () => {
    expect(clientSearch(notes, "quantum", noteSearchText).map((n) => n.id)).toEqual([
      "1",
      "3",
    ]);
    expect(clientSearch(notes, "EGGS", noteSearchText).map((n) => n.id)).toEqual([
      "2",
    ]);
  });
  it("returns [] for blank queries", () => {
    expect(clientSearch(notes, "  ", noteSearchText)).toEqual([]);
  });
  it("caps results at the given limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `${i}`,
      title: "quantum topic",
      markdown_body: "",
    }));
    expect(clientSearch(many, "quantum", noteSearchText, 20)).toHaveLength(20);
    expect(clientSearch(many, "quantum", noteSearchText)).toHaveLength(
      SEARCH_LIMIT,
    );
  });
  it("paper/idea selectors cover authors and descriptions", () => {
    const papers = [
      { title: "Deep Learning", abstract: "neural nets", authors: ["LeCun"] },
    ];
    expect(clientSearch(papers, "lecun", paperSearchText)).toHaveLength(1);
    const ideas = [{ title: "Fusion", description: "stellarator design" }];
    expect(clientSearch(ideas, "stellarator", ideaSearchText)).toHaveLength(1);
  });
});

describe("search RPC wiring (migration 1762624300)", () => {
  beforeEach(() => {
    mockSupabaseClient.rpc.mockReset();
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("calls search_notes with { search_user_id, search_query, limit_count }", async () => {
    await searchNotesViaRpc("user-1", "quantum");
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith("search_notes", {
      search_user_id: "user-1",
      search_query: "quantum",
      limit_count: 20,
    });
  });

  it("caps every entity RPC at limit(20) by default", async () => {
    await searchPapersViaRpc("user-1", "quantum");
    await searchIdeasViaRpc("user-1", "quantum");
    await globalSearchViaRpc("user-1", "quantum");
    for (const call of mockSupabaseClient.rpc.mock.calls) {
      expect(call[1]).toMatchObject({ limit_count: 20 });
    }
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "global_search",
      expect.objectContaining({ search_user_id: "user-1" }),
    );
  });

  it("returns rows when the RPC succeeds", async () => {
    const rows = [{ id: "1", rank: 0.9 }];
    mockSupabaseClient.rpc.mockResolvedValue({ data: rows, error: null });
    await expect(searchNotesViaRpc("user-1", "quantum")).resolves.toBe(rows);
  });

  it("falls back (null) on RPC error, bad payload, throw, or blank query", async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(searchNotesViaRpc("user-1", "quantum")).resolves.toBeNull();

    mockSupabaseClient.rpc.mockResolvedValue({ data: { nope: true }, error: null });
    await expect(searchNotesViaRpc("user-1", "quantum")).resolves.toBeNull();

    mockSupabaseClient.rpc.mockRejectedValue(new Error("network down"));
    await expect(searchNotesViaRpc("user-1", "quantum")).resolves.toBeNull();

    mockSupabaseClient.rpc.mockClear();
    await expect(searchNotesViaRpc("user-1", "   ")).resolves.toBeNull();
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });
});
