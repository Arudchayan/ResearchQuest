import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildDemoTables,
  DEMO_FIRST_RUN_NOTE_ID,
  DEMO_FIRST_RUN_PATH,
  DEMO_FIRST_RUN_TOPIC_ID,
} from "../../lib/demoData";

describe("demo first-run seed and entry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("seeds the first-run topic with exactly three papers and an empty note", () => {
    const tables = buildDemoTables();
    const topicId = DEMO_FIRST_RUN_TOPIC_ID;

    const paperIds = tables.topic_papers
      .filter((row) => row.topic_id === topicId)
      .map((row) => row.paper_id);
    expect(paperIds).toHaveLength(3);

    const noteIds = tables.topic_notes
      .filter((row) => row.topic_id === topicId)
      .map((row) => row.note_id);
    expect(noteIds).toContain(DEMO_FIRST_RUN_NOTE_ID);

    const emptyNote = tables.notes.find((row) => row.id === DEMO_FIRST_RUN_NOTE_ID);
    expect(emptyNote).toBeDefined();
    expect(String(emptyNote?.markdown_body ?? "").trim()).toBe("");
  });

  it("enters demo mode and lands on the seeded topic path (not dashboard)", async () => {
    const supabase = await vi.importActual<typeof import("../../lib/supabase")>(
      "../../lib/supabase",
    );

    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload: vi.fn(), pathname: "/", href: "http://localhost/" },
    });

    supabase.enableDemoModeAndReload();

    expect(localStorage.getItem(supabase.DEMO_MODE_STORAGE_KEY)).toBe("1");
    expect(assign).toHaveBeenCalledWith(DEMO_FIRST_RUN_PATH);
    expect(DEMO_FIRST_RUN_PATH).toBe(`/topics/${DEMO_FIRST_RUN_TOPIC_ID}`);
    expect(DEMO_FIRST_RUN_PATH).not.toBe("/");
  });
});
