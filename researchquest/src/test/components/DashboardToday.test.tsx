import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Dashboard } from "../../components/dashboard/Dashboard";
import { useAppStore } from "../../store/appStore";
import type { Idea, Note, Task } from "../../types/database";

// ---------------------------------------------------------------------------
// Helpers — mirror DashboardRouting.test.tsx store-mock pattern
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Local date-only string N days from today (negative = past). */
const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
};

/** Mirrors parseDateInput's local-timezone handling for date-only strings. */
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatShortDate = (dateString: string) =>
  parseLocalDate(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

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
    ideas: [],
    topics: {},
    tasks: [],
    notesLoading: false,
    papersLoading: false,
    ideasLoading: false,
    tasksLoading: false,
    topicsLoading: false,
    dataSyncErrors: { notes: null, papers: null, ideas: null, tasks: null, topics: null },
    ...overrides,
  });
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

// ---------------------------------------------------------------------------
// Dashboard "Today" deck — decision-first section
// ---------------------------------------------------------------------------

describe("Dashboard Today deck", () => {
  beforeEach(() => {
    resetStore();
    window.history.replaceState(null, "", "/");
  });

  it("renders overdue and due-today tasks with correct copy, capped at 3 rows", () => {
    resetStore({
      tasks: [
        fakeTask({ id: "t-overdue-5", title: "Finish literature review", due_date: dateOffset(-5) }),
        fakeTask({ id: "t-overdue-3", title: "Send revised draft", due_date: dateOffset(-3) }),
        fakeTask({ id: "t-today-1", title: "Submit abstract", due_date: dateOffset(0) }),
        fakeTask({ id: "t-today-2", title: "Email advisor", due_date: dateOffset(0) }),
        fakeTask({
          id: "t-completed",
          title: "Done task",
          due_date: dateOffset(-9),
          completed: true,
        }),
        fakeTask({ id: "t-future", title: "Future task", due_date: dateOffset(3) }),
      ],
    });

    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Today" }).tagName).toBe("H2");
    expect(screen.getByText("The work that's waiting for you")).toBeInTheDocument();

    const taskRows = screen.getAllByRole("button", { name: /^Open task:/ });
    expect(taskRows).toHaveLength(3);
    expect(taskRows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Open task: Finish literature review",
      "Open task: Send revised draft",
      "Open task: Submit abstract",
    ]);

    const overdueRow = screen.getByRole("button", {
      name: "Open task: Finish literature review",
    });
    expect(within(overdueRow).getByText("5 days overdue")).toBeInTheDocument();
    const overdueBadge = within(overdueRow).getByText(/days overdue$/);
    expect(overdueBadge.classList.contains("bg-destructive-bg")).toBe(true);
    expect(overdueBadge.classList.contains("text-destructive")).toBe(true);

    expect(
      within(screen.getByRole("button", { name: "Open task: Send revised draft" })).getByText(
        "3 days overdue",
      ),
    ).toBeInTheDocument();

    const todayRow = screen.getByRole("button", { name: "Open task: Submit abstract" });
    expect(within(todayRow).getByText(`Due ${formatShortDate(dateOffset(0))}`)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Open task: Email advisor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open task: Done task" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open task: Future task" })).toBeNull();
  });

  it("renders stuck-idea and untagged-note rows (most recently updated first)", () => {
    const nowIso = new Date().toISOString();
    resetStore({
      ideas: [
        fakeIdea({
          id: "i-stuck",
          title: "Quantum memory survey",
          stage: "Seed",
          created_at: new Date(Date.now() - 21 * MS_PER_DAY).toISOString(),
        }),
        fakeIdea({ id: "i-fresh", title: "Fresh seed", stage: "Seed", created_at: nowIso }),
        fakeIdea({
          id: "i-developing",
          title: "Developing old idea",
          stage: "Developing",
          created_at: new Date(Date.now() - 21 * MS_PER_DAY).toISOString(),
        }),
      ],
      notes: [
        fakeNote({ id: "n-untagged-1", title: "Quick references", updated_at: "2026-02-01T10:00:00Z" }),
        fakeNote({ id: "n-untagged-2", title: undefined, updated_at: "2026-01-15T10:00:00Z" }),
        fakeNote({ id: "n-tagged", title: "Tagged note", tags: ["ai"], updated_at: "2026-03-01T10:00:00Z" }),
      ],
    });

    render(<Dashboard />);

    const ideaRow = screen.getByRole("button", { name: "Open idea: Quantum memory survey" });
    expect(within(ideaRow).getByText("Seed 21d")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Open idea: Fresh seed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open idea: Developing old idea" })).toBeNull();

    const noteRows = screen.getAllByRole("button", { name: /^Open note:/ });
    expect(noteRows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Open note: Quick references",
      "Open note: Untitled Note",
    ]);
    expect(within(noteRows[0]).getByText("No tags")).toBeInTheDocument();
    expect(within(noteRows[1]).getByText("No tags")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Open note: Tagged note" })).toBeNull();
  });

  it("shows the quiet empty-deck message and links to focus and ideas", () => {
    resetStore({
      tasks: [
        fakeTask({ id: "t-done", title: "Done task", due_date: dateOffset(-9), completed: true }),
      ],
      ideas: [
        fakeIdea({
          id: "i-fresh",
          title: "Fresh seed",
          stage: "Seed",
          created_at: new Date().toISOString(),
        }),
      ],
      notes: [fakeNote({ id: "n-tagged", title: "Tagged note", tags: ["ai"] })],
    });

    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(within(deck).getByText(/Nothing urgent — the field is clear/)).toBeInTheDocument();

    fireEvent.click(within(deck).getByRole("button", { name: "Start a focus session" }));
    expect(window.location.pathname).toBe("/focus");
    expect(useAppStore.getState().currentView).toBe("focus");

    fireEvent.click(within(deck).getByRole("button", { name: "review an idea" }));
    expect(window.location.pathname).toBe("/ideas");
    expect(useAppStore.getState().currentView).toBe("ideas");
  });

  it("renders skeleton rows instead of the empty-deck message while deck resources are loading", () => {
    resetStore({
      tasksLoading: true,
      ideasLoading: true,
      notesLoading: true,
    });

    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(
      within(deck).queryByText(/Nothing urgent — the field is clear/),
    ).toBeNull();
    expect(within(deck).getByRole("status")).toBeInTheDocument();
  });

  it("does not claim the field is clear when a deck resource failed to sync", () => {
    resetStore({
      dataSyncErrors: {
        notes: null,
        papers: null,
        ideas: { resource: "ideas", message: "Ideas failed to load" },
        tasks: null,
        topics: null,
      },
    });

    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(
      within(deck).queryByText(/Nothing urgent — the field is clear/),
    ).toBeNull();
  });

  it("deep-links to the entity view when a row is clicked", () => {
    const task = fakeTask({ id: "t-1", title: "Finish literature review", due_date: dateOffset(-2) });
    const idea = fakeIdea({
      id: "i-1",
      title: "Quantum memory survey",
      stage: "Seed",
      created_at: new Date(Date.now() - 21 * MS_PER_DAY).toISOString(),
    });
    const note = fakeNote({ id: "n-1", title: "Quick references" });
    resetStore({ tasks: [task], ideas: [idea], notes: [note] });

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Open task: Finish literature review" }));
    expect(window.location.pathname).toBe("/tasks/t-1");
    expect(useAppStore.getState().currentView).toBe("tasks");
    expect(useAppStore.getState().selectedTask?.id).toBe("t-1");

    fireEvent.click(screen.getByRole("button", { name: "Open idea: Quantum memory survey" }));
    expect(window.location.pathname).toBe("/ideas/i-1");
    expect(useAppStore.getState().currentView).toBe("ideas");
    expect(useAppStore.getState().selectedIdea?.id).toBe("i-1");

    fireEvent.click(screen.getByRole("button", { name: "Open note: Quick references" }));
    expect(window.location.pathname).toBe("/notes/n-1");
    expect(useAppStore.getState().currentView).toBe("notes");
    expect(useAppStore.getState().selectedNote?.id).toBe("n-1");
  });
});
