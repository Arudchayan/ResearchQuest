import { describe, it, expect, vi } from "vitest";

const dbHitCounts = {
  topic_notes: 0,
  topic_papers: 0,
  topic_ideas: 0
};

const mockSupabase = {
  from: vi.fn().mockImplementation((table: string) => {
    dbHitCounts[table as keyof typeof dbHitCounts]++;
    return {
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(() => {
          return new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 50));
        })
      })
    };
  })
};

const tableSupportCache = new Map<string, boolean>();

async function tableSupportsUserIdOld(table: string): Promise<boolean> {
  if (tableSupportCache.has(table)) {
    return tableSupportCache.get(table)!;
  }
  const { error } = await mockSupabase.from(table).select("user_id").limit(1);
  let supported = true;
  if (error) supported = false;
  tableSupportCache.set(table, supported);
  return supported;
}

const tableSupportPromiseCache = new Map<string, Promise<boolean>>();

function tableSupportsUserIdNew(table: string): Promise<boolean> {
  let promise = tableSupportPromiseCache.get(table);
  if (!promise) {
    promise = (async () => {
      const { error } = await mockSupabase.from(table).select("user_id").limit(1);
      let supported = true;
      if (error) supported = false;
      return supported;
    })();
    tableSupportPromiseCache.set(table, promise);
  }
  return promise;
}

describe("table support check performance improvement", () => {
  it("benchmarks Old vs New under concurrent mounts", async () => {
    // Simulate 5 instances of a hook calling this concurrently
    const startOld = performance.now();
    await Promise.all(
      new Array(5).fill(0).map(() =>
        Promise.all(["topic_notes", "topic_papers", "topic_ideas"].map(tableSupportsUserIdOld))
      )
    );
    const endOld = performance.now();
    const oldTime = endOld - startOld;
    const oldHits = dbHitCounts.topic_notes + dbHitCounts.topic_papers + dbHitCounts.topic_ideas;

    dbHitCounts.topic_notes = 0;
    dbHitCounts.topic_papers = 0;
    dbHitCounts.topic_ideas = 0;

    const startNew = performance.now();
    await Promise.all(
      new Array(5).fill(0).map(() =>
        Promise.all(["topic_notes", "topic_papers", "topic_ideas"].map(tableSupportsUserIdNew))
      )
    );
    const endNew = performance.now();
    const newTime = endNew - startNew;
    const newHits = dbHitCounts.topic_notes + dbHitCounts.topic_papers + dbHitCounts.topic_ideas;

    console.log(`Old Time: ${oldTime}ms, DB Hits: ${oldHits}`);
    console.log(`New Time: ${newTime}ms, DB Hits: ${newHits}`);
    expect(newHits).toBeLessThan(oldHits);
  });
});
