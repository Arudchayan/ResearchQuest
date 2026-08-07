import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../../components/dashboard/Dashboard";
import { FocusTargetAside } from "../../components/focus/FocusTargetAside";
import { useAppStore } from "../../store/appStore";
import { FileText } from "lucide-react";
import {
  parseRoute,
  isValidView,
  selectEntityForRoute,
  type ParsedRoute,
  type RouteDataSnapshot,
  type RouteSelectionSetters,
} from "../../lib/router";
import type { Paper, Idea, Note, TopicWithCounts, Task } from "../../types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal store shape needed for Dashboard tests. */
function resetStore(overrides?: Record<string, unknown>) {
  useAppStore.setState({
    currentView: "dashboard",
    user: {
      id: "user-1",
      username: "Scholar",
      total_xp: 100,
      current_level: 1,
      current_streak: 0,
      longest_streak: 0,
      streak_freeze_tokens: 0,
      rest_days: 0,
      active_boost: null,
      theme_preference: "light",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    notes: [],
    papers: [],
    tasks: [],
    notesLoading: false,
    papersLoading: false,
    tasksLoading: false,
    ...overrides,
  });
}

/** Factory for a mock Paper. */
function fakePaper(overrides?: Partial<Paper>): Paper {
  const id = overrides?.id ?? "paper-1";
  return {
    id,
    user_id: "user-1",
    title: `Paper ${id}`,
    authors: ["Author A"],
    status: "To Read",
    doi: null,
    source_url: null,
    topic_ids: [],
    abstract: null,
    publication_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeIdea(overrides?: Partial<Idea>): Idea {
  const id = overrides?.id ?? "idea-1";
  return {
    id,
    user_id: "user-1",
    title: `Idea ${id}`,
    description: null,
    stage: "Seed",
    linked_note_ids: [],
    linked_paper_ids: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeNote(overrides?: Partial<Note>): Note {
  const id = overrides?.id ?? "note-1";
  return {
    id,
    user_id: "user-1",
    title: `Note ${id}`,
    markdown_body: "body",
    tags: [],
    linked_entity_ids: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeTopic(overrides?: Partial<TopicWithCounts>): TopicWithCounts {
  const id = overrides?.id ?? "topic-1";
  return {
    id,
    user_id: "user-1",
    name: `Topic ${id}`,
    description: null,
    note_count: 0,
    paper_count: 0,
    idea_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeTask(overrides?: Partial<Task>): Task {
  const id = overrides?.id ?? "task-1";
  return {
    id,
    user_id: "user-1",
    title: `Task ${id}`,
    description: null,
    priority: "medium",
    due_date: null,
    completed: false,
    category: null,
    project_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseRoute — typed route parsing
// ---------------------------------------------------------------------------

describe("parseRoute", () => {
  it("returns dashboard for root path", () => {
    const r = parseRoute("/");
    expect(r).toEqual<ParsedRoute>({
      view: "dashboard",
      itemId: null,
      isValid: true,
    });
  });

  it("returns dashboard for empty path", () => {
    const r = parseRoute("");
    expect(r).toEqual<ParsedRoute>({
      view: "dashboard",
      itemId: null,
      isValid: true,
    });
  });

  it.each([
    ["/notes", "notes"],
    ["/papers", "papers"],
    ["/ideas", "ideas"],
    ["/tasks", "tasks"],
    ["/topics", "topics"],
    ["/focus", "focus"],
    ["/dashboard", "dashboard"],
  ])("parses view-only path %s as %s", (path, expectedView) => {
    const r = parseRoute(path);
    expect(r).toMatchObject({ view: expectedView, itemId: null, isValid: true });
  });

  it("parses deep-link path with itemId", () => {
    const r = parseRoute("/papers/abc-123");
    expect(r).toMatchObject({ view: "papers", itemId: "abc-123", isValid: true });
  });

  it("parses view with extra segments (drops extra path parts)", () => {
    // /dashboard/notes → view="dashboard", itemId="notes"
    // The extra "notes" segment is consumed as itemId, not an error.
    const r = parseRoute("/dashboard/notes");
    expect(r).toMatchObject({ view: "dashboard", itemId: "notes", isValid: true });
  });

  it.each([
    ["/unknown"],
    ["/gibberish/123"],
    ["//"],
  ])("marks path %s as invalid", (path) => {
    const r = parseRoute(path);
    expect(r.isValid).toBe(false);
    expect(r.view).toBeNull();
    expect(r.itemId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidView — type guard
// ---------------------------------------------------------------------------

describe("isValidView", () => {
  it.each([
    "dashboard",
    "notes",
    "papers",
    "ideas",
    "tasks",
    "topics",
    "focus",
  ])("returns true for %s", (view) => {
    expect(isValidView(view)).toBe(true);
  });

  it.each(["unknown", "", "gibberish", "settings"])(
    "returns false for %s",
    (view) => {
      expect(isValidView(view)).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// selectEntityForRoute — deep-link entity hydration
// ---------------------------------------------------------------------------

describe("selectEntityForRoute", () => {
  const paper1 = fakePaper({ id: "p1" });
  const paper2 = fakePaper({ id: "p2" });
  const idea1 = fakeIdea({ id: "i1" });
  const note1 = fakeNote({ id: "n1" });
  const topic1 = fakeTopic({ id: "t1" });
  const task1 = fakeTask({ id: "tk1" });

  const defaultData: RouteDataSnapshot = {
    papers: [paper1, paper2],
    papersLoading: false,
    ideas: [idea1],
    ideasLoading: false,
    notes: [note1],
    notesLoading: false,
    topics: { t1: topic1 },
    topicsLoading: false,
    tasks: [task1],
    tasksLoading: false,
  };

  function mockSetters(): RouteSelectionSetters & {
    calls: Record<string, unknown[]>;
  } {
    const calls: Record<string, unknown[]> = {};
    return {
      setSelectedPaper: vi.fn((p) => {
        calls.setSelectedPaper ??= [];
        calls.setSelectedPaper.push(p);
      }) as unknown as (p: Paper | null) => void,
      setSelectedIdea: vi.fn((i) => {
        calls.setSelectedIdea ??= [];
        calls.setSelectedIdea.push(i);
      }) as unknown as (i: Idea | null) => void,
      setSelectedNote: vi.fn((n) => {
        calls.setSelectedNote ??= [];
        calls.setSelectedNote.push(n);
      }) as unknown as (n: Note | null) => void,
      setSelectedTopic: vi.fn((t) => {
        calls.setSelectedTopic ??= [];
        calls.setSelectedTopic.push(t);
      }) as unknown as (t: TopicWithCounts | null) => void,
      setSelectedTask: vi.fn((t) => {
        calls.setSelectedTask ??= [];
        calls.setSelectedTask.push(t);
      }) as unknown as (t: Task | null) => void,
      calls,
    };
  }

  it("does nothing when route has no itemId", () => {
    const route = parseRoute("/papers");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls).toEqual({});
  });

  it("does nothing when route is invalid", () => {
    const route = parseRoute("/unknown");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls).toEqual({});
  });

  it("selects a paper when data is loaded and found", () => {
    const route = parseRoute("/papers/p1");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedPaper).toEqual([paper1]);
  });

  it("clears paper selection when item not found after load", () => {
    const route = parseRoute("/papers/missing");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedPaper).toEqual([null]);
  });

  it("returns early when papers are still loading", () => {
    const route = parseRoute("/papers/p1");
    const s = mockSetters();
    selectEntityForRoute(route, { ...defaultData, papersLoading: true }, s);
    expect(s.calls).toEqual({});
  });

  it("selects an idea when data is loaded", () => {
    const route = parseRoute("/ideas/i1");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedIdea).toEqual([idea1]);
  });

  it("returns early when ideas are still loading", () => {
    const route = parseRoute("/ideas/i1");
    const s = mockSetters();
    selectEntityForRoute(route, { ...defaultData, ideasLoading: true }, s);
    expect(s.calls).toEqual({});
  });

  it("selects a note when data is loaded", () => {
    const route = parseRoute("/notes/n1");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedNote).toEqual([note1]);
  });

  it("selects a topic when data is loaded (Record lookup)", () => {
    const route = parseRoute("/topics/t1");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedTopic).toEqual([topic1]);
  });

  it("clears topic selection when not found", () => {
    const route = parseRoute("/topics/missing");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedTopic).toEqual([null]);
  });

  it("selects a task when data is loaded", () => {
    const route = parseRoute("/tasks/tk1");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls.setSelectedTask).toEqual([task1]);
  });

  it("does nothing for dashboard route (no entity)", () => {
    const route = parseRoute("/");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls).toEqual({});
  });

  it("does nothing for focus route (no entity)", () => {
    const route = parseRoute("/focus");
    const s = mockSetters();
    selectEntityForRoute(route, defaultData, s);
    expect(s.calls).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Dashboard navigation — integration tests against the rendered component
// ---------------------------------------------------------------------------

describe("Dashboard navigation", () => {
  beforeEach(() => {
    resetStore();
    window.history.replaceState(null, "", "/");
  });

  it("navigates to /notes from the recent notes action", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /view all/i }));
    expect(window.location.pathname).toBe("/notes");
    expect(useAppStore.getState().currentView).toBe("notes");
  });

  it("navigates to /papers from the reading list action", () => {
    render(<Dashboard />);
    // The papers section has a "View Library" button
    fireEvent.click(screen.getByRole("button", { name: /view library/i }));
    expect(window.location.pathname).toBe("/papers");
    expect(useAppStore.getState().currentView).toBe("papers");
  });

  it("navigates to /ideas from the active ideas action", () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /view board/i }));
    expect(window.location.pathname).toBe("/ideas");
    expect(useAppStore.getState().currentView).toBe("ideas");
  });

  it("navigates to /focus from the start focus session button", () => {
    render(<Dashboard />);
    fireEvent.click(
      screen.getByRole("button", { name: /start focus session/i }),
    );
    expect(window.location.pathname).toBe("/focus");
    expect(useAppStore.getState().currentView).toBe("focus");
  });

  it("retry button clears the error and bumps the per-resource retry counter", () => {
    resetStore({
      dataSyncErrors: {
        notes: { resource: "notes", message: "notes unavailable" },
        papers: null,
        ideas: null,
        tasks: null,
        topics: null,
      },
    });

    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(useAppStore.getState().dataSyncErrors.notes).toBeNull();
    expect(useAppStore.getState().dataSyncRetryCounters.notes).toBe(1);
  });
});

describe("Focus target navigation", () => {
  beforeEach(() => {
    resetStore();
    window.history.replaceState(null, "", "/");
  });

  it("navigates to /notes from the Notes View all action", () => {
    render(
      <FocusTargetAside
        isLoading={false}
        quickTargets={[
          {
            type: "note",
            title: "Notes",
            description: "Choose a note to focus on",
            icon: FileText,
            items: [],
          },
        ]}
        selectedTarget={null}
        handleTargetSelection={() => undefined}
        collapsedGroups={{ note: false, paper: true, task: true }}
        toggleGroup={() => undefined}
        collapsedPanels={{ suggestions: true }}
        togglePanel={() => undefined}
        focusInsights={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open the full notes view" }),
    );

    expect(window.location.pathname).toBe("/notes");
    expect(useAppStore.getState().currentView).toBe("notes");
  });
});

// ---------------------------------------------------------------------------
// Routing behavior — store + URL coordination
// ---------------------------------------------------------------------------

describe("Routing behavior", () => {
  beforeEach(() => {
    resetStore();
    window.history.replaceState(null, "", "/");
  });

  it("popstate event triggers currentView update from URL", () => {
    // Wire up the same pattern the App uses: popstate → parseRoute → setCurrentView
    const handler = () => {
      const route = parseRoute(window.location.pathname);
      if (route.isValid && route.view) {
        useAppStore.getState().setCurrentView(route.view);
      }
    };
    window.addEventListener("popstate", handler);

    // Start at dashboard
    expect(useAppStore.getState().currentView).toBe("dashboard");

    // Simulate forward navigation: pushState + manually update view
    window.history.pushState(null, "", "/notes");
    useAppStore.getState().setCurrentView("notes");
    expect(useAppStore.getState().currentView).toBe("notes");

    // Simulate popstate back to dashboard: pushState updates the URL,
    // then dispatching PopStateEvent triggers the handler.
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useAppStore.getState().currentView).toBe("dashboard");

    window.removeEventListener("popstate", handler);
  });

  it("auth-redirect preserves the pending path as a parseable route", () => {
    // Simulate the auth-save effect:
    // When user is not logged in and path is non-root, save the path.
    const pendingPath = "/notes";

    // The path should parse correctly
    const route = parseRoute(pendingPath);
    expect(route.isValid).toBe(true);
    expect(route.view).toBe("notes");
    expect(route.itemId).toBeNull();

    // Simulate post-login restoration
    window.history.pushState(null, "", pendingPath);
    useAppStore.getState().setCurrentView(route.view!);
    expect(window.location.pathname).toBe("/notes");
    expect(useAppStore.getState().currentView).toBe("notes");
  });

  it("auth-redirect preserves a deep-link path with itemId", () => {
    const pendingPath = "/papers/deep-paper-42";
    const route = parseRoute(pendingPath);
    expect(route.isValid).toBe(true);
    expect(route.view).toBe("papers");
    expect(route.itemId).toBe("deep-paper-42");

    // Restore
    window.history.pushState(null, "", pendingPath);
    useAppStore.getState().setCurrentView(route.view!);
    expect(window.location.pathname).toBe("/papers/deep-paper-42");
    expect(useAppStore.getState().currentView).toBe("papers");
  });

  it("invalid route does NOT silently redirect to root (recovery contract)", () => {
    // An invalid path should be detected by parseRoute
    const route = parseRoute("/nonexistent/page");
    expect(route.isValid).toBe(false);

    // The app should NOT redirect silently — the recovery UI contract
    // means we keep the URL and surface the error.
    // We can't directly test the render of App.tsx here, but we verify
    // the parsing layer correctly identifies invalid routes so the
    // recovery branch in the component can fire.
    expect(route.view).toBeNull();
    expect(route.itemId).toBeNull();
  });
});
