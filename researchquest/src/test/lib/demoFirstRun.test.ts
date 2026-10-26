import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildDemoTables,
  DEMO_FIRST_RUN_NOTE_ID,
  DEMO_FIRST_RUN_PATH,
  DEMO_FIRST_RUN_TOPIC_ID,
  DEMO_WORKSPACE_ENTERED_KEY,
  ensureDemoFirstRunPath,
  hasEnteredDemoWorkspace,
  isDemoFirstRunPath,
  markDemoWorkspaceEntered,
} from "../../lib/demoData";

describe("demo first-run seed and entry", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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

    sessionStorage.setItem(DEMO_WORKSPACE_ENTERED_KEY, "1");
    supabase.enableDemoModeAndReload();

    expect(localStorage.getItem(supabase.DEMO_MODE_STORAGE_KEY)).toBe("1");
    expect(sessionStorage.getItem(DEMO_WORKSPACE_ENTERED_KEY)).toBeNull();
    expect(assign).toHaveBeenCalledWith(DEMO_FIRST_RUN_PATH);
    expect(DEMO_FIRST_RUN_PATH).toBe(`/topics/${DEMO_FIRST_RUN_TOPIC_ID}`);
    expect(DEMO_FIRST_RUN_PATH).not.toBe("/");
  });

  it("treats only the seeded topic path as first-run, not /topics", () => {
    expect(isDemoFirstRunPath("/topics/topic-ai-agents")).toBe(true);
    expect(isDemoFirstRunPath("/topics")).toBe(false);
    expect(isDemoFirstRunPath("/topics/")).toBe(false);
    expect(isDemoFirstRunPath("/notes")).toBe(false);
  });

  it("aborts entry when unsaved changes are rejected (data-loss guard)", async () => {
    const supabase = await vi.importActual<typeof import("../../lib/supabase")>(
      "../../lib/supabase",
    );

    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, reload: vi.fn(), pathname: "/", href: "http://localhost/" },
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    const entered = supabase.enableDemoModeAndReload({
      hasUnsavedChanges: true,
    });

    expect(entered).toBe(false);
    expect(confirm).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(localStorage.getItem(supabase.DEMO_MODE_STORAGE_KEY)).not.toBe("1");
  });

  it("Go to full workspace: / stays on Today after the user has entered the demo shell", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: vi.fn(),
        reload: vi.fn(),
        pathname: "/",
        href: "http://localhost/",
      },
    });

    expect(ensureDemoFirstRunPath(true)).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, "", DEMO_FIRST_RUN_PATH);

    replaceState.mockClear();
    markDemoWorkspaceEntered();
    expect(hasEnteredDemoWorkspace()).toBe(true);
    expect(sessionStorage.getItem(DEMO_WORKSPACE_ENTERED_KEY)).toBe("1");
    expect(ensureDemoFirstRunPath(true)).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("does not rewrite / when demo mode is off", () => {
    window.history.replaceState(null, "", "/");
    expect(ensureDemoFirstRunPath(false)).toBe(false);
    expect(window.location.pathname).toBe("/");
  });

  it("exits demo mode to the full workspace (no dead-end loop)", async () => {
    const supabase = await vi.importActual<typeof import("../../lib/supabase")>(
      "../../lib/supabase",
    );

    localStorage.setItem(supabase.DEMO_MODE_STORAGE_KEY, "1");
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign,
        reload: vi.fn(),
        pathname: DEMO_FIRST_RUN_PATH,
        href: `http://localhost${DEMO_FIRST_RUN_PATH}`,
      },
    });

    supabase.disableDemoModeAndReload("/");

    expect(localStorage.getItem(supabase.DEMO_MODE_STORAGE_KEY)).toBeNull();
    expect(assign).toHaveBeenCalledWith("/");
  });
});
