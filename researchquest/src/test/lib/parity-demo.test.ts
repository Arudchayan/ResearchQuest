/**
 * Item 49 — demo parity harness.
 *
 * Contract tests asserting the demo client exposes the same surface the
 * live app uses through the gateway layer (`GATEWAY_SURFACE` in
 * lib/apiGateway.ts): list reads per resource, the `global_search` RPC the
 * server-search path calls, the `save_idea_with_links` transaction RPC, and
 * the `fetch-paper` / `deep-research` edge functions.
 *
 * Any parity failure prints the exact op/signature mismatch so the gap is
 * actionable: `PARITY MISMATCH op=... expected=... actual=...`.
 */
import { describe, expect, it } from "vitest";
import { demoSupabase } from "../../lib/demoSupabase";
import { DEMO_USER_ID } from "../../lib/demoData";
import { GATEWAY_SURFACE } from "../../lib/apiGateway";

function parityAssert(
  condition: unknown,
  op: string,
  expected: string,
  actual: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `PARITY MISMATCH op=${op} expected=${expected} actual=${actual}`,
    );
  }
}

describe("demo parity harness (item 49)", () => {
  it("supports every gateway list resource via .from()", async () => {
    for (const resource of GATEWAY_SURFACE.lists) {
      const { data, error } = await demoSupabase
        .from(resource)
        .select("*")
        .eq("user_id", DEMO_USER_ID)
        .order("updated_at", { ascending: false });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      parityAssert(
        !error,
        `list:${resource}`,
        "error=null",
        `error=${error ? String(error.message ?? error) : "null"}`,
      );
      parityAssert(
        Array.isArray(data),
        `list:${resource}`,
        "data=[] (array)",
        `data=${typeof data}`,
      );
    }
  });

  it("exposes global_search with the exact server RPC signature", async () => {
    const spec = GATEWAY_SURFACE.rpc.find((entry) => entry.name === "global_search");
    parityAssert(
      !!spec,
      "rpc:global_search",
      "spec present in GATEWAY_SURFACE",
      "spec missing",
    );
    expect([...(spec?.args ?? [])]).toEqual([
      "search_user_id",
      "search_query",
      "limit_count",
    ]);

    const { data, error } = await demoSupabase.rpc("global_search", {
      search_user_id: DEMO_USER_ID,
      search_query: "RAG",
      limit_count: 5,
    });
    parityAssert(
      !error,
      "rpc:global_search",
      "error=null",
      `error=${error ? String((error as { message?: string }).message ?? error) : "null"}`,
    );
    parityAssert(
      Array.isArray(data) && data.length > 0,
      "rpc:global_search",
      "data=[>=1 match for 'RAG']",
      `data=${JSON.stringify(data)}`,
    );
    const noteHit = (data as Array<Record<string, unknown>>).find(
      (row) => row.entity_type === "note",
    );
    parityAssert(
      !!noteHit,
      "rpc:global_search",
      "entity_type=note present",
      `rows=${JSON.stringify(data)}`,
    );
    for (const key of [
      "entity_type",
      "entity_id",
      "title",
      "snippet",
      "rank",
      "updated_at",
    ]) {
      parityAssert(
        noteHit != null && key in (noteHit as Record<string, unknown>),
        "rpc:global_search",
        `row has column ${key}`,
        `row=${JSON.stringify(noteHit)}`,
      );
    }
  });

  it("honours limit_count and empty/other-user queries", async () => {
    const limited = await demoSupabase.rpc("global_search", {
      search_user_id: DEMO_USER_ID,
      search_query: "RAG",
      limit_count: 1,
    });
    expect(limited.error).toBeNull();
    expect((limited.data as unknown[]).length).toBeLessThanOrEqual(1);

    const empty = await demoSupabase.rpc("global_search", {
      search_user_id: DEMO_USER_ID,
      search_query: "   ",
      limit_count: 5,
    });
    expect(empty.error).toBeNull();
    expect(empty.data).toEqual([]);

    const foreign = await demoSupabase.rpc("global_search", {
      search_user_id: "00000000-0000-4000-8000-000000000000",
      search_query: "RAG",
      limit_count: 5,
    });
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
  });

  it("keeps save_idea_with_links parity with the exact arg signature", async () => {
    const spec = GATEWAY_SURFACE.rpc.find(
      (entry) => entry.name === "save_idea_with_links",
    );
    expect([...(spec?.args ?? [])]).toEqual([
      "p_idea_id",
      "p_user_id",
      "p_title",
      "p_description",
      "p_stage",
      "p_linked_note_ids",
      "p_linked_paper_ids",
    ]);

    const { data, error } = await demoSupabase.rpc("save_idea_with_links", {
      p_idea_id: null,
      p_user_id: DEMO_USER_ID,
      p_title: "Parity probe idea",
      p_description: "Created by the parity harness.",
      p_stage: "Seed",
      p_linked_note_ids: [],
      p_linked_paper_ids: [],
    });
    parityAssert(
      !error,
      "rpc:save_idea_with_links",
      "error=null",
      `error=${error ? String((error as { message?: string }).message ?? error) : "null"}`,
    );
    parityAssert(
      !!data && (data as { id?: unknown }).id != null,
      "rpc:save_idea_with_links",
      "data={id,...}",
      `data=${JSON.stringify(data)}`,
    );
  });

  it("keeps edge-function parity for fetch-paper and deep-research", async () => {
    for (const name of GATEWAY_SURFACE.functions) {
      const result =
        name === "fetch-paper"
          ? await demoSupabase.functions.invoke(name, {
              body: { query: "transformer", rows: 1 },
            })
          : await demoSupabase.functions.invoke(name, {
              body: { query: "attention mechanisms" },
            });
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      parityAssert(
        !result.error,
        `functions:${name}`,
        "error=null",
        `error=${JSON.stringify(result.error)}`,
      );
      parityAssert(
        result.data != null,
        `functions:${name}`,
        "data=<payload>",
        "data=null",
      );
    }
  });
});
