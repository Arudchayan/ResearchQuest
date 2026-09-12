import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
  isDemoMode: false,
}));

import {
  getProfileForXp,
  getProfileXpTotals,
  updateProfile,
  writeXpUpdate,
  PROFILE_XP_COLUMNS,
} from "../../lib/repos/profilesRepo";
import {
  listEarnedAchievementTypes,
  insertAchievementRow,
} from "../../lib/repos/achievementsRepo";
import {
  getDailyLogForDate,
  updateDailyLogRow,
  insertDailyLogRow,
} from "../../lib/repos/dailyLogsRepo";
import { makeEntityRepo } from "../../lib/repos/entityRepo";
import { papersRepo } from "../../lib/repos/papersRepo";
import { notesRepo } from "../../lib/repos/notesRepo";
import { ideasRepo } from "../../lib/repos/ideasRepo";
import { tasksRepo } from "../../lib/repos/tasksRepo";
import { topicsRepo } from "../../lib/repos/topicsRepo";
import {
  promoteFeedItemRequest,
  updateFeedItemStatusRow,
} from "../../lib/repos/feedItemsRepo";
import { performDeepResearch } from "../../lib/repos/researchRepo";

/** Chainable builder whose terminal await resolves `resolved`. */
function chainable(resolved: unknown) {
  const builder: any = {};
  for (const method of [
    "select",
    "eq",
    "insert",
    "update",
    "upsert",
    "delete",
    "order",
    "gte",
    "lte",
    "neq",
    "in",
    "limit",
    "not",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(resolved));
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolved));
  builder.then = (onFulfilled?: (value: any) => any) =>
    Promise.resolve(resolved).then(onFulfilled);
  return builder;
}

describe("lib/repos (PR15 item 39)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("profilesRepo", () => {
    it("reads the full XP column set for one profile", async () => {
      const profile = { id: "u", total_xp: 100 };
      const builder = chainable({ data: profile, error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      const result = await getProfileForXp("u");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("user_profiles");
      expect(builder.select).toHaveBeenCalledWith(PROFILE_XP_COLUMNS);
      expect(builder.eq).toHaveBeenCalledWith("id", "u");
      expect(builder.single).toHaveBeenCalled();
      expect(result).toEqual({ data: profile, error: null });
    });

    it("reads narrow totals for the achievement credit path", async () => {
      const builder = chainable({ data: { total_xp: 1 }, error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      await getProfileXpTotals("u");

      expect(builder.select).toHaveBeenCalledWith("total_xp, current_level");
    });

    it("writes XP via a single increment_xp RPC in live mode", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: { total_xp: 120, current_level: 1, current_streak: 4 },
        error: null,
      });

      const result = await writeXpUpdate("u", 20, {
        total_xp: 120,
        current_level: 1,
        current_streak: 4,
        longest_streak: 5,
        last_activity_date: "2026-09-12",
        notes_count: 1,
        papers_count: 0,
        tasks_completed_count: 0,
        papers_with_insights_count: 0,
        streak_freeze_tokens: null,
      } as any);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "increment_xp",
        expect.objectContaining({
          p_user_id: "u",
          p_xp_earned: 20,
          p_current_streak: 4,
          p_notes_count: 1,
        }),
      );
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(result).toEqual({ totalXp: 120, level: 1, streak: 4 });
    });

    it("fails open to the legacy direct update when the RPC errors", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });
      const builder = chainable({ error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);
      const payload = { total_xp: 110, current_level: 1 } as any;

      const result = await writeXpUpdate("u", 10, payload);

      expect(builder.update).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ totalXp: 110, level: 1, streak: 1 });
    });

    it("returns null when both the RPC and the fallback update fail", async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });
      mockSupabaseClient.from.mockImplementation(() =>
        chainable({ error: { message: "down" } }),
      );

      const result = await writeXpUpdate("u", 10, { total_xp: 1 } as any);

      expect(result).toBeNull();
    });

    it("updates a profile with the legacy chain", async () => {
      const builder = chainable({ error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      await updateProfile("u", { total_xp: 5 } as any);

      expect(builder.update).toHaveBeenCalledWith({ total_xp: 5 });
      expect(builder.eq).toHaveBeenCalledWith("id", "u");
    });
  });

  describe("achievementsRepo / dailyLogsRepo", () => {
    it("lists earned achievement types for a user", async () => {
      const builder = chainable({ data: [], error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      await listEarnedAchievementTypes("u");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        "research_achievements",
      );
      expect(builder.select).toHaveBeenCalledWith("achievement_type");
      expect(builder.eq).toHaveBeenCalledWith("user_id", "u");
    });

    it("inserts an achievement row", async () => {
      const builder = chainable({ error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);
      const row = {
        user_id: "u",
        achievement_type: "first-paper",
        title: "First Paper",
        description: "d",
        xp_awarded: 50,
      };

      await insertAchievementRow(row);

      expect(builder.insert).toHaveBeenCalledWith(row);
    });

    it("reads, patches, and creates daily-log rows", async () => {
      const builder = chainable({ data: null, error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      await getDailyLogForDate("u", "2026-09-12");
      expect(builder.select).toHaveBeenCalledWith("*");
      expect(builder.eq).toHaveBeenCalledWith("user_id", "u");
      expect(builder.eq).toHaveBeenCalledWith("date", "2026-09-12");
      expect(builder.maybeSingle).toHaveBeenCalled();

      await updateDailyLogRow("log-1", { xp_earned: 10, streak_count: 2 });
      expect(builder.update).toHaveBeenCalledWith({
        xp_earned: 10,
        streak_count: 2,
      });

      await insertDailyLogRow({
        user_id: "u",
        date: "2026-09-12",
        xp_earned: 10,
        streak_count: 2,
      });
      expect(builder.insert).toHaveBeenCalledWith({
        user_id: "u",
        date: "2026-09-12",
        xp_earned: 10,
        streak_count: 2,
      });
    });
  });

  describe("entity repos", () => {
    it("binds each entity to its table", () => {
      expect(papersRepo.tableName).toBe("papers");
      expect(notesRepo.tableName).toBe("notes");
      expect(ideasRepo.tableName).toBe("ideas");
      expect(tasksRepo.tableName).toBe("tasks");
      expect(topicsRepo.tableName).toBe("topics");
    });

    it("mirrors the useEntityCrud insert/update/remove/restore chains", async () => {
      const repo = makeEntityRepo<{ id: string }>("notes");
      const row = { id: "n-1", user_id: "u", title: "t" };
      const builder = chainable({ data: row, error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      const inserted = await repo.insert({ user_id: "u", title: "t" });
      expect(builder.insert).toHaveBeenCalledWith({ user_id: "u", title: "t" });
      expect(builder.select).toHaveBeenCalled();
      expect(inserted).toEqual({ data: row, error: null });

      const updated = await repo.update("n-1", "u", { title: "t2" });
      expect(builder.update).toHaveBeenCalledWith({ title: "t2" });
      expect(builder.eq).toHaveBeenCalledWith("id", "n-1");
      expect(builder.eq).toHaveBeenCalledWith("user_id", "u");
      expect(updated.data).toEqual(row);

      const silent = await repo.update("n-1", "u", { title: "t3" }, false);
      expect(silent).toEqual({ data: null, error: null });

      const removed = await repo.remove("n-1", "u");
      expect(builder.delete).toHaveBeenCalled();
      expect(removed).toEqual({ error: null });

      const restored = await repo.restore(row);
      expect(builder.upsert).toHaveBeenCalledWith(row, {
        onConflict: "id",
      });
      expect(restored.data).toEqual(row);
    });

    it("batch-inserts N papers in one round-trip", async () => {
      const rows = [
        { user_id: "u", title: "a", authors: [], status: "Inbox" },
        { user_id: "u", title: "b", authors: [], status: "Inbox" },
      ];
      const builder = chainable({ data: rows, error: null });
      const insertSpy = vi.fn(() => builder);
      builder.insert = insertSpy;
      mockSupabaseClient.from.mockImplementation(() => builder);

      const result = await papersRepo.insertMany(rows as any);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("papers");
      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledWith(rows);
      expect(result).toEqual({ data: rows, error: null });
    });
  });

  describe("feedItemsRepo", () => {
    it("posts the promotion to the edge-function URL with the bearer token", async () => {
      const promoted = { target: "papers", entity: {}, item: { id: "f" } };
      const fetchSpy = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(promoted),
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const result = await promoteFeedItemRequest({
        itemId: "f 1",
        target: "papers",
        accessToken: "tok",
        baseUrl: "https://x/functions/v1/api/v1",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://x/functions/v1/api/v1/feed-items/f%201/promote",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ target: "papers" }),
        }),
      );
      expect(fetchSpy.mock.calls[0]?.[1].headers).toMatchObject({
        Authorization: "Bearer tok",
      });
      expect(result).toEqual({ ok: true, promoted });

      vi.unstubAllGlobals();
    });

    it("maps API failures to { ok: false, message }", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({ error: { message: "quota spent" } }),
          }),
        ),
      );

      const result = await promoteFeedItemRequest({
        itemId: "f",
        target: "notes",
        accessToken: "tok",
        baseUrl: "https://x",
      });

      expect(result).toEqual({ ok: false, message: "quota spent" });

      vi.unstubAllGlobals();
    });

    it("updates a feed-item status and returns the row", async () => {
      const row = { id: "f", status: "dismissed" };
      const builder = chainable({ data: row, error: null });
      mockSupabaseClient.from.mockImplementation(() => builder);

      const result = await updateFeedItemStatusRow("f", "u", "dismissed");

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("feed_items");
      expect(builder.update).toHaveBeenCalledWith({ status: "dismissed" });
      expect(result).toEqual({ data: row, error: null });
    });
  });

  describe("researchRepo", () => {
    it("invokes deep-research once and returns data.data", async () => {
      const payload = { query: "q", papers: [] };
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: { data: payload },
        error: null,
      });

      const result = await performDeepResearch("q");

      expect(
        mockSupabaseClient.functions.invoke,
      ).toHaveBeenCalledWith("deep-research", { body: { query: "q" } });
      expect(
        mockSupabaseClient.functions.invoke,
      ).toHaveBeenCalledTimes(1);
      expect(result).toEqual(payload);
    });

    it("rethrows edge-function errors", async () => {
      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: "bad" },
      });

      await expect(performDeepResearch("q")).rejects.toEqual({
        message: "bad",
      });
    });
  });
});
