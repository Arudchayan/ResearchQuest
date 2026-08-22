import { describe, expect, it } from "vitest";
import { demoSupabase } from "../../lib/demoSupabase";
import { DEMO_USER_ID } from "../../lib/demoData";

describe("demoSupabase", () => {
  it("signs in with a session and demo user", async () => {
    const { data } = await demoSupabase.auth.signInWithPassword({
      email: "demo@researchquest.app",
      password: "ResearchQuest!2026",
    });

    expect(data.session).toBeTruthy();
    expect(data.session?.user.id).toBe(DEMO_USER_ID);
    expect(data.session?.access_token).toBeTruthy();
  });

  it("queries seeded notes with filters, ordering, and range", async () => {
    const { data, count } = await demoSupabase
      .from("notes")
      .select("id, user_id, title, markdown_body, tags, linked_entity_ids, created_at, updated_at", {
        count: "exact",
      })
      .eq("user_id", DEMO_USER_ID)
      .order("updated_at", { ascending: false })
      .range(0, 2);

    expect(data).toHaveLength(3);
    expect(count).toBe(9);
    expect(data?.[0]).toMatchObject({
      user_id: DEMO_USER_ID,
      title: "RAG design notes",
    });
    expect(data?.[0].id).toBeDefined();
    expect(data?.[0].markdown_body).toBeDefined();
  });

  it("counts papers with head queries", async () => {
    const { count, data } = await demoSupabase
      .from("papers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", DEMO_USER_ID);

    expect(count).toBe(7);
    expect(data).toHaveLength(0);
  });

  it("projects topic relationship counts", async () => {
    const { data } = await demoSupabase
      .from("topics")
      .select("*, topic_notes(count), topic_papers(count), topic_ideas(count)")
      .eq("user_id", DEMO_USER_ID)
      .eq("id", "topic-ai-agents")
      .maybeSingle();

    expect(data?.id).toBe("topic-ai-agents");
    expect(data?.topic_notes?.[0]?.count).toBe(3);
    expect(data?.topic_papers?.[0]?.count).toBe(2);
    expect(data?.topic_ideas?.[0]?.count).toBe(2);
  });

  it("creates and reads back a task", async () => {
    const before = (
      await demoSupabase
        .from("tasks")
        .select("id")
        .eq("user_id", DEMO_USER_ID)
    ).count;

    const { data: created } = await demoSupabase
      .from("tasks")
      .insert({
        user_id: DEMO_USER_ID,
        title: "Demo-only test task",
        completed: false,
        priority: "low",
      })
      .select()
      .single();

    expect(created?.id).toBeDefined();
    expect(created?.title).toBe("Demo-only test task");

    const after = (
      await demoSupabase
        .from("tasks")
        .select("id")
        .eq("user_id", DEMO_USER_ID)
        .eq("title", "Demo-only test task")
    ).count;
    expect(after).toBeNull();

    const afterRows = await demoSupabase
      .from("tasks")
      .select("id", { count: "exact" })
      .eq("user_id", DEMO_USER_ID)
      .eq("title", "Demo-only test task");
    expect(afterRows.count).toBe(1);
    expect(afterRows.data?.length).toBe(1);
  });

  it("updates and deletes rows", async () => {
    const { data: created } = await demoSupabase
      .from("tasks")
      .insert({
        user_id: DEMO_USER_ID,
        title: "Demo-only mutable task",
        completed: false,
        priority: "medium",
      })
      .select()
      .single();

    await demoSupabase
      .from("tasks")
      .update({ completed: true })
      .eq("id", created?.id);

    const { data: updated } = await demoSupabase
      .from("tasks")
      .select("completed")
      .eq("id", created?.id)
      .maybeSingle();
    expect(updated?.completed).toBe(true);

    await demoSupabase.from("tasks").delete().eq("id", created?.id);

    const { data: removed } = await demoSupabase
      .from("tasks")
      .select("id")
      .eq("id", created?.id)
      .maybeSingle();
    expect(removed).toBeNull();
  });

  it("supports upsert on conflict", async () => {
    await demoSupabase.from("tasks").upsert(
      {
        id: "upsert-test-task",
        user_id: DEMO_USER_ID,
        title: "Upsert first",
        completed: false,
        priority: "low",
      },
      { onConflict: "id" },
    );
    await demoSupabase.from("tasks").upsert(
      {
        id: "upsert-test-task",
        user_id: DEMO_USER_ID,
        title: "Upsert second",
        completed: true,
        priority: "low",
      },
      { onConflict: "id" },
    );

    const { data } = await demoSupabase
      .from("tasks")
      .select("title, completed")
      .eq("id", "upsert-test-task")
      .maybeSingle();
    expect(data).toMatchObject({ title: "Upsert second", completed: true });
  });

  it("runs the idea transaction RPC", async () => {
    const { data } = await demoSupabase.rpc("save_idea_with_links", {
      p_user_id: DEMO_USER_ID,
      p_idea_id: null,
      p_title: "RPC demo idea",
      p_description: "Created through the demo RPC.",
      p_stage: "Seed",
      p_linked_note_ids: [],
      p_linked_paper_ids: [],
    });

    expect(data?.id).toBeDefined();
    expect(data?.title).toBe("RPC demo idea");
  });

  it("invokes the deep research function", async () => {
    const { data, error } = await demoSupabase.functions.invoke("deep-research", {
      body: { query: "attention mechanisms" },
    });

    expect(error).toBeNull();
    expect(data?.data?.summary).toContain("attention");
    expect(data?.data?.reasoningSteps.length).toBeGreaterThan(0);
  });

  it("invokes fetch-paper for DOI and query lookups", async () => {
    const doiResult = await demoSupabase.functions.invoke("fetch-paper", {
      body: { doi: "10.48550/arXiv.2005.11401" },
    });
    expect(doiResult.data?.data?.title).toContain("Retrieval-Augmented");

    const queryResult = await demoSupabase.functions.invoke("fetch-paper", {
      body: { query: "transformer", rows: 2 },
    });
    expect(queryResult.data?.data?.length).toBe(2);
  });

  it("subscribes and emits realtime channel events", async () => {
    let received: string | null = null;
    const channel = demoSupabase
      .channel("test_channel")
      .on(
        "postgres_changes",
        { schema: "public", table: "tasks", filter: `user_id=eq.${DEMO_USER_ID}` },
        (payload) => {
          received = payload.eventType;
        },
      )
      .subscribe();

    await demoSupabase.from("tasks").insert({
      user_id: DEMO_USER_ID,
      title: "Realtime demo task",
      completed: false,
      priority: "low",
    });

    expect(received).toBe("INSERT");
    channel.unsubscribe();
  });
});
