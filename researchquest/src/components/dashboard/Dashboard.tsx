import { useCallback, useMemo } from "react";
import {
  FileText,
  Plus,
  Flame,
  Star,
  Sparkles,
  CheckSquare,
  BookOpen,
  Lightbulb,
  Hash,
} from "lucide-react";
import {
  ActivityLogIcon,
  ArrowRightIcon,
  TargetIcon,
} from "@radix-ui/react-icons";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { getLevelTitle } from "../../utils/gamification";
import { parseDateInput } from "../../utils/time";
import { getTopN } from "../../utils/collections";
import { isOverdue } from "../tasks/TaskCard";
import { ListSkeleton } from "../ui/Skeleton";
import { InlineError } from "../ui/ErrorFallback";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";
import type { Idea, Note, Paper, Task, TopicWithCounts } from "../../types/database";

type DashboardView = "notes" | "papers" | "focus" | "tasks" | "ideas" | "topics";

const ideaStageBadgeVariants = {
  Seed: "stage-seed",
  Developing: "stage-developing",
  Supported: "stage-supported",
  Mature: "stage-mature",
} satisfies Record<Idea["stage"], BadgeVariant>;

const taskPriorityBadgeVariants = {
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
} satisfies Record<Task["priority"], BadgeVariant>;

const formatCount = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

interface SectionIndexProps {
  number: string;
  label: string;
}

const SectionIndex = ({ number, label }: SectionIndexProps) => (
  <span className="font-mono text-caption text-text-tertiary">
    {number} · {label.toUpperCase()}
  </span>
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole calendar days between an ISO/date-only string and now (local). */
const daysBetween = (from: string, to: Date) =>
  Math.floor(
    (startOfLocalDay(to).getTime() -
      startOfLocalDay(parseDateInput(from) ?? to).getTime()) /
      MS_PER_DAY,
  );

/** TaskCard semantics: a due date settles at end-of-day, so "due today" is still today until midnight. */
const isDueToday = (dueDate: string | undefined): boolean => {
  const parsed = parseDateInput(dueDate);
  if (!parsed) return false;
  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
};

const formatDueDate = (dueDate: string | undefined) => {
  const parsed = parseDateInput(dueDate);
  if (!parsed) return "";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

type TodayItem =
  | { kind: "task-overdue"; task: Task; daysOverdue: number }
  | { kind: "task-today"; task: Task }
  | { kind: "idea-stuck"; idea: Idea; daysInSeed: number }
  | { kind: "note-untagged"; note: Note };

export function Dashboard() {
  // ⚡ PERFORMANCE OPTIMIZATION:
  // Using useShallow to prevent unnecessary re-renders of the entire Dashboard
  // when unrelated properties in the global appStore change.
  const {
    user,
    notes,
    papers,
    ideas,
    tasks,
    topics,
    focusSessionSecondsToday,
    notesLoading,
    papersLoading,
    ideasLoading,
    tasksLoading,
    topicsLoading,
    dataSyncErrors,
    retryDataSync,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setSelectedTopic,
    setSelectedTask,
  } = useAppStore(
      useShallow((state) => ({
        user: state.user,
        notes: state.notes,
        papers: state.papers,
        ideas: state.ideas,
        tasks: state.tasks,
        topics: state.topics,
        focusSessionSecondsToday: state.focusSessionSecondsToday,
        notesLoading: state.notesLoading,
        papersLoading: state.papersLoading,
        ideasLoading: state.ideasLoading,
        tasksLoading: state.tasksLoading,
        topicsLoading: state.topicsLoading,
        dataSyncErrors: state.dataSyncErrors,
        retryDataSync: state.retryDataSync,
        setCurrentView: state.setCurrentView,
        setSelectedNote: state.setSelectedNote,
        setSelectedPaper: state.setSelectedPaper,
        setSelectedIdea: state.setSelectedIdea,
        setSelectedTopic: state.setSelectedTopic,
        setSelectedTask: state.setSelectedTask,
      })),
    );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const stats = useMemo(() => {
    if (!user) return null;
    const xpInLevel = (user.total_xp || 0) % 500;
    const progress = Math.min(100, (xpInLevel / 500) * 100);

    return {
      level: user.current_level || 1,
      title: getLevelTitle(user.current_level || 1),
      xp: user.total_xp || 0,
      streak: user.current_streak ?? 0,
      progress,
    };
  }, [user]);

  const focusMinutesToday = useMemo(
    () => Math.floor(focusSessionSecondsToday / 60),
    [focusSessionSecondsToday],
  );

  // ⚡ PERFORMANCE OPTIMIZATION:
  // Compute multiple aggregate statistics in a single O(N) pass inside useMemo.
  // This avoids chaining multiple .filter().length calls that create unnecessary
  // intermediate arrays and trigger redundant iterations during render.
  const { pendingTaskCount, completedTaskCount } = useMemo(() => {
    let pending = 0;
    let completed = 0;
    for (const task of tasks) {
      if (task.completed) {
        completed++;
      } else {
        pending++;
      }
    }
    return { pendingTaskCount: pending, completedTaskCount: completed };
  }, [tasks]);

  const recentNotes = useMemo(() => {
    return getTopN(notes, 3, (a, b) => {
      return b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0;
    });
  }, [notes]);

  const readingList = useMemo(() => {
    return getTopN(
      papers,
      3,
      (a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0),
      (p) => p.status === "To Read"
    );
  }, [papers]);

  const activeIdeas = useMemo(() => {
    return getTopN(ideas, 3, (a, b) => (b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0));
  }, [ideas]);

  const activeTopics = useMemo(() => {
    return getTopN(Object.values(topics), 3, (a, b) => (b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0));
  }, [topics]);

  const upcomingTasks = useMemo(() => {
    return getTopN(
      tasks,
      3,
      (a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0;
      },
      (t) => !t.completed
    );
  }, [tasks]);

  // "Today" deck — decision-first: the work that's waiting right now.
  // Sourced in priority order (overdue → due today → stuck ideas → untagged
  // notes) and capped at 3 compact rows so the deck stays decision-first.
  const todayItems = useMemo((): TodayItem[] => {
    const now = new Date();

    const overdueTasks = getTopN(
      tasks,
      3,
      (a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0;
      },
      (task) => !task.completed && isOverdue(task.due_date)
    );

    const dueTodayTasks = getTopN(
      tasks,
      3,
      (a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0;
      },
      (task) => !task.completed && isDueToday(task.due_date)
    );

    const stuckIdeas = getTopN(
      ideas,
      2,
      (a, b) => (a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0),
      (idea) => idea.stage === "Seed" && daysBetween(idea.created_at, now) >= 14
    );

    const untaggedNotes = getTopN(
      notes,
      2,
      (a, b) => (b.updated_at > a.updated_at ? 1 : b.updated_at < a.updated_at ? -1 : 0),
      (note) => note.tags.length === 0
    );

    return [
      ...overdueTasks.map((task) => ({
        kind: "task-overdue" as const,
        task,
        daysOverdue: task.due_date ? daysBetween(task.due_date, now) : 0,
      })),
      ...dueTodayTasks.map((task) => ({ kind: "task-today" as const, task })),
      ...stuckIdeas.map((idea) => ({
        kind: "idea-stuck" as const,
        idea,
        daysInSeed: daysBetween(idea.created_at, now),
      })),
      ...untaggedNotes.map((note) => ({ kind: "note-untagged" as const, note })),
    ].slice(0, 3);
  }, [tasks, ideas, notes]);

  const navigateTo = useCallback(
    (view: DashboardView, path = `/${view}`) => {
      setCurrentView(view);
      window.history.pushState(null, "", path);
    },
    [setCurrentView],
  );

  const handleFocusNavigation = useCallback(() => navigateTo("focus"), [navigateTo]);
  const handleNotesNavigation = useCallback(() => navigateTo("notes"), [navigateTo]);
  const handlePapersNavigation = useCallback(() => navigateTo("papers"), [navigateTo]);
  const handleIdeasNavigation = useCallback(() => navigateTo("ideas"), [navigateTo]);
  const handleTasksNavigation = useCallback(() => navigateTo("tasks"), [navigateTo]);
  const handleTopicsNavigation = useCallback(() => navigateTo("topics"), [navigateTo]);

  const handleOpenNote = useCallback(
    (note: Note) => {
      setSelectedNote(note);
      navigateTo("notes", `/notes/${note.id}`);
    },
    [navigateTo, setSelectedNote],
  );

  const handleOpenPaper = useCallback(
    (paper: Paper) => {
      setSelectedPaper(paper);
      navigateTo("papers", `/papers/${paper.id}`);
    },
    [navigateTo, setSelectedPaper],
  );

  const handleOpenIdea = useCallback(
    (idea: Idea) => {
      setSelectedIdea(idea);
      navigateTo("ideas", `/ideas/${idea.id}`);
    },
    [navigateTo, setSelectedIdea],
  );

  const handleOpenTask = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      navigateTo("tasks", `/tasks/${task.id}`);
    },
    [navigateTo, setSelectedTask],
  );

  const handleOpenTopic = useCallback(
    (topic: TopicWithCounts) => {
      setSelectedTopic(topic);
      navigateTo("topics", `/topics/${topic.id}`);
    },
    [navigateTo, setSelectedTopic],
  );

  const handleRetryNotes = useCallback(
    () => retryDataSync("notes"),
    [retryDataSync],
  );
  const handleRetryPapers = useCallback(
    () => retryDataSync("papers"),
    [retryDataSync],
  );
  const handleRetryIdeas = useCallback(
    () => retryDataSync("ideas"),
    [retryDataSync],
  );
  const handleRetryTasks = useCallback(
    () => retryDataSync("tasks"),
    [retryDataSync],
  );
  const handleRetryTopics = useCallback(
    () => retryDataSync("topics"),
    [retryDataSync],
  );

  const notesSyncError = dataSyncErrors?.notes ?? null;
  const papersSyncError = dataSyncErrors?.papers ?? null;
  const ideasSyncError = dataSyncErrors?.ideas ?? null;
  const tasksSyncError = dataSyncErrors?.tasks ?? null;
  const topicsSyncError = dataSyncErrors?.topics ?? null;

  // The Today deck sources from tasks, ideas, and notes — only claim the
  // field is clear once those resources have settled without errors.
  const todayDeckLoading = tasksLoading || ideasLoading || notesLoading;
  const todayDeckSyncError =
    tasksSyncError || ideasSyncError || notesSyncError;

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 animate-in fade-in sm:p-6 lg:space-y-10 lg:p-8">
      <PageHeader
        title={
          <span className="flex min-w-0 flex-wrap items-center gap-2 break-words">
            {greeting}, {user.username || "Scholar"}
            <Sparkles className="h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
          </span>
        }
        description={<span className="font-serif italic">Ready to make some progress today?</span>}
        actions={
          <>
            <Button type="button" variant="outline" onClick={handleTasksNavigation}>
              <CheckSquare aria-hidden="true" />
              Review {pendingTaskCount} {pendingTaskCount === 1 ? "task" : "tasks"}
            </Button>
            <Button type="button" onClick={handleFocusNavigation}>
              <TargetIcon aria-hidden="true" />
              Start Focus Session
            </Button>
          </>
        }
      />

      {/* Today deck — decision-first: the work that's waiting for you */}
      <section aria-labelledby="today-heading">
        <Card className="p-5">
          <SectionIndex number="01" label="Today" />
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle pb-2">
            <h2 id="today-heading" className="font-serif text-body-lg font-bold text-text-primary">
              Today
            </h2>
            <p className="text-small text-text-secondary">
              The work that&apos;s waiting for you
            </p>
          </div>

          {todayItems.length === 0 ? (
            todayDeckLoading ? (
              <ListSkeleton count={3} itemType="task" />
            ) : todayDeckSyncError ? null : (
              <p className="text-small text-text-tertiary">
                Nothing urgent — the field is clear.{" "}
                <button
                  type="button"
                  onClick={handleFocusNavigation}
                  className="font-medium text-primary-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  Start a focus session
                </button>{" "}
                or{" "}
                <button
                  type="button"
                  onClick={handleIdeasNavigation}
                  className="font-medium text-primary-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  review an idea
                </button>
                .
              </p>
            )
          ) : (
            <ul className="space-y-2">
              {todayItems.map((item) => {
                if (item.kind === "idea-stuck") {
                  return (
                    <li key={`idea-${item.idea.id}`}>
                      <button
                        type="button"
                        onClick={() => handleOpenIdea(item.idea)}
                        aria-label={`Open idea: ${item.idea.title}`}
                        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 rounded-sm border border-border-moderate bg-bg-base p-2 text-text-primary">
                            <Lightbulb className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="truncate text-small font-medium text-text-primary">
                            {item.idea.title}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-caption text-text-tertiary">
                          Seed {item.daysInSeed}d
                        </span>
                      </button>
                    </li>
                  );
                }

                if (item.kind === "note-untagged") {
                  return (
                    <li key={`note-${item.note.id}`}>
                      <button
                        type="button"
                        onClick={() => handleOpenNote(item.note)}
                        aria-label={`Open note: ${item.note.title || "Untitled Note"}`}
                        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 rounded-sm border border-border-moderate bg-bg-base p-2 text-text-primary">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="truncate text-small font-medium text-text-primary">
                            {item.note.title || "Untitled Note"}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-caption text-text-tertiary">
                          No tags
                        </span>
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={`task-${item.task.id}`}>
                    <button
                      type="button"
                      onClick={() => handleOpenTask(item.task)}
                      aria-label={`Open task: ${item.task.title}`}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 rounded-sm border border-border-moderate bg-bg-base p-2 text-text-primary">
                          <CheckSquare className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="truncate text-small font-medium text-text-primary">
                          {item.task.title}
                        </span>
                      </span>
                      {item.kind === "task-overdue" ? (
                        <Badge variant="destructive" className="shrink-0 font-mono">
                          {formatCount(item.daysOverdue, "day")} overdue
                        </Badge>
                      ) : (
                        <span className="shrink-0 font-mono text-caption text-text-tertiary">
                          Due {formatDueDate(item.task.due_date)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* RQ-M2-07 entity counts — source: store */}
      <Card
        role="group"
        aria-label="Library counts"
        className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-small text-text-secondary sm:grid-cols-5"
      >
        <span>Notes <strong className="font-mono font-medium text-text-primary">{notes.length}</strong></span>
        <span>Papers <strong className="font-mono font-medium text-text-primary">{papers.length}</strong></span>
        <span>Ideas <strong className="font-mono font-medium text-text-primary">{ideas.length}</strong></span>
        <span>Tasks <strong className="font-mono font-medium text-text-primary">{tasks.length}</strong></span>
        <span>Topics <strong className="font-mono font-medium text-text-primary">{Object.keys(topics).length}</strong></span>
      </Card>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          {/* Recent Notes */}
          <section>
            <SectionIndex number="02" label="Recent Notes" />
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-body-lg font-bold text-text-primary">
                <FileText className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                Recent Notes
              </h2>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleNotesNavigation}
                className="shrink-0 px-0 text-small uppercase tracking-wider"
              >
                View all <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>

            {notesSyncError && (
              <InlineError
                message={notesSyncError.message}
                onRetry={handleRetryNotes}
                className="mb-4"
              />
            )}

            <div className="space-y-3">
              {notesLoading ? (
                <ListSkeleton count={3} itemType="note" />
              ) : recentNotes.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No notes yet"
                  description="Create a note to keep your latest thinking close at hand."
                  className="rounded-surface border border-dashed border-border-strong bg-bg-elevated"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleNotesNavigation}
                    >
                      <Plus aria-hidden="true" /> Create note
                    </Button>
                  }
                />
              ) : (
                recentNotes.map((note) => (
                  <Card key={note.id} className="overflow-hidden transition-colors hover:border-border-strong">
                    <button
                      type="button"
                      onClick={() => handleOpenNote(note)}
                      className="group block w-full p-4 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <h3 className="mb-1 truncate font-semibold text-text-primary group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-2">
                        {note.title || "Untitled Note"}
                      </h3>
                      <p className="line-clamp-2 text-small text-text-secondary">
                        {note.markdown_body.slice(0, 150) || "No content"}
                      </p>
                      <div className="mt-3 text-caption text-text-tertiary">
                        Updated {new Date(note.updated_at).toLocaleDateString()}
                      </div>
                    </button>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Active Ideas */}
          <section>
            <SectionIndex number="03" label="Active Ideas" />
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-body-lg font-bold text-text-primary">
                <Lightbulb className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                Active Ideas
              </h2>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleIdeasNavigation}
                className="shrink-0 px-0 text-small uppercase tracking-wider"
              >
                View Board <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>

            {ideasSyncError && (
              <InlineError
                message={ideasSyncError.message}
                onRetry={handleRetryIdeas}
                className="mb-4"
              />
            )}

            <div className="space-y-3">
              {ideasLoading ? (
                <ListSkeleton count={3} itemType="idea" />
              ) : activeIdeas.length === 0 ? (
                <EmptyState
                  icon={<Lightbulb className="h-5 w-5" />}
                  title="No active ideas"
                  description="Add an idea to start developing your next line of inquiry."
                  className="rounded-surface border border-dashed border-border-strong bg-bg-elevated"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleIdeasNavigation}
                    >
                      <Plus aria-hidden="true" /> Add idea
                    </Button>
                  }
                />
              ) : (
                activeIdeas.map((idea) => (
                  <Card key={idea.id} className="overflow-hidden transition-colors hover:border-border-strong">
                    <button
                      type="button"
                      onClick={() => handleOpenIdea(idea)}
                      className="group block w-full p-4 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="mb-1 truncate font-semibold text-text-primary group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-2">
                            {idea.title}
                          </h3>
                          {idea.description && (
                            <p className="mt-1 line-clamp-2 text-small text-text-secondary">
                              {idea.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={ideaStageBadgeVariants[idea.stage]}>
                          {idea.stage}
                        </Badge>
                      </div>
                    </button>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Active Topics */}
          <section>
            <SectionIndex number="04" label="Active Topics" />
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-body-lg font-bold text-text-primary">
                <Hash className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                Active Topics
              </h2>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleTopicsNavigation}
                className="shrink-0 px-0 text-small uppercase tracking-wider"
              >
                View Directory <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>

            {topicsSyncError && (
              <InlineError
                message={topicsSyncError.message}
                onRetry={handleRetryTopics}
                className="mb-4"
              />
            )}

            <div className="space-y-3">
              {topicsLoading ? (
                <ListSkeleton count={3} itemType="note" />
              ) : activeTopics.length === 0 ? (
                <EmptyState
                  icon={<Hash className="h-5 w-5" />}
                  title="No active topics"
                  description="Create a topic to organize related research."
                  className="rounded-surface border border-dashed border-border-strong bg-bg-elevated"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTopicsNavigation}
                    >
                      <Plus aria-hidden="true" /> Add topic
                    </Button>
                  }
                />
              ) : (
                activeTopics.map((topic) => (
                  <Card key={topic.id} className="overflow-hidden transition-colors hover:border-border-strong">
                    <button
                      type="button"
                      onClick={() => handleOpenTopic(topic)}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0 rounded-sm border border-border-moderate bg-bg-base p-2 text-text-primary">
                          <Hash className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="truncate text-small font-medium text-text-primary">
                          {topic.name}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-caption text-text-tertiary">
                        {formatCount(topic.note_count + topic.paper_count + topic.idea_count, "item")}
                      </span>
                    </button>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Reading List & Tasks */}
        <div className="space-y-8">
          {/* Reading List */}
          <section>
            <SectionIndex number="05" label="Up Next to Read" />
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-body-lg font-bold text-text-primary">
                <BookOpen className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                Up Next to Read
              </h2>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handlePapersNavigation}
                className="shrink-0 px-0 text-small uppercase tracking-wider"
              >
                View Library <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>

            {papersSyncError && (
              <InlineError
                message={papersSyncError.message}
                onRetry={handleRetryPapers}
                className="mb-4"
              />
            )}

            <div className="space-y-3">
              {papersLoading ? (
                <ListSkeleton count={3} itemType="paper" />
              ) : readingList.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title="Your reading list is empty"
                  description="Add a paper to keep the next useful reference in view."
                  className="rounded-surface border border-dashed border-border-strong bg-bg-elevated"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePapersNavigation}
                    >
                      <Plus aria-hidden="true" /> Add paper
                    </Button>
                  }
                />
              ) : (
                readingList.map((paper) => (
                  <Card key={paper.id} className="overflow-hidden transition-colors hover:border-border-strong">
                    <button
                      type="button"
                      onClick={() => handleOpenPaper(paper)}
                      className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <div className="shrink-0 rounded-sm border border-border-moderate bg-bg-base p-2 text-text-primary">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-text-primary">{paper.title}</h3>
                        <p className="mt-0.5 truncate text-small text-text-secondary">
                          {paper.authors?.join(", ") || "Unknown Author"}
                        </p>
                      </div>
                    </button>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Due Soon */}
          <section>
            <SectionIndex number="06" label="Tasks Due Soon" />
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 items-center gap-2 font-serif text-body-lg font-bold text-text-primary">
                <CheckSquare className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                Tasks Due Soon
              </h2>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleTasksNavigation}
                className="shrink-0 px-0 text-small uppercase tracking-wider"
              >
                All Tasks <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>

            {tasksSyncError && (
              <InlineError
                message={tasksSyncError.message}
                onRetry={handleRetryTasks}
                className="mb-4"
              />
            )}

            <div className="space-y-3">
              {tasksLoading ? (
                <ListSkeleton count={3} itemType="task" />
              ) : upcomingTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckSquare className="h-5 w-5" />}
                  title="No upcoming tasks"
                  description="You&apos;re all caught up for now."
                  className="rounded-surface border border-dashed border-border-strong bg-bg-elevated"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTasksNavigation}
                    >
                      <Plus aria-hidden="true" /> Add task
                    </Button>
                  }
                />
              ) : (
                upcomingTasks.map((task) => (
                  <Card key={task.id} className="overflow-hidden transition-colors hover:border-border-strong">
                    <button
                      type="button"
                      onClick={handleTasksNavigation}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                    >
                      <span className="min-w-0 truncate text-small font-medium text-text-primary">
                        {task.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={taskPriorityBadgeVariants[task.priority]}
                          className="capitalize"
                        >
                          {task.priority}
                        </Badge>
                        {task.due_date && (
                          <span className="font-mono text-caption text-text-tertiary">
                            {new Date(task.due_date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </span>
                    </button>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {stats && (
        <section aria-labelledby="progress-heading">
          <SectionIndex number="07" label="Progress" />
          <div className="mb-4 flex items-center gap-3 border-b border-border-subtle pb-2">
            <ActivityLogIcon className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
            <h2 id="progress-heading" className="font-serif text-subtitle font-bold text-text-primary">
              Progress
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5 transition-colors hover:border-primary-500">
              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold text-primary-600">
                  <Star className="h-4 w-4" aria-hidden="true" />
                  <span className="text-caption uppercase tracking-widest">Level {stats.level}</span>
                </div>
                <p className="mb-1 font-serif text-subtitle font-bold text-text-primary">{stats.title}</p>
                <p className="mb-3 font-mono text-code text-text-secondary">{stats.xp.toLocaleString()} XP total</p>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated"
                  aria-label={`${stats.progress}% of this level complete`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={stats.progress}
                >
                  <div className="h-full bg-primary-500" style={{ width: `${stats.progress}%` }} />
                </div>
              </div>
            </Card>
            <Card className="p-5 transition-colors hover:border-warning">
              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold text-warning">
                  <Flame className="h-4 w-4" aria-hidden="true" />
                  <span className="text-caption uppercase tracking-widest">Day streak</span>
                </div>
                <p className="mb-1 font-mono text-subtitle font-bold text-text-primary">
                  {formatCount(stats.streak, "day")}
                </p>
                <p className="text-small text-text-secondary">Keep it up to earn bonus XP.</p>
              </div>
            </Card>
            <Card className="p-5 transition-colors hover:border-purple">
              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold text-purple">
                  <TargetIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="text-caption uppercase tracking-widest">Today&apos;s focus</span>
                </div>
                <p className="mb-1 font-mono text-subtitle font-bold text-text-primary">{focusMinutesToday} min</p>
                <p className="text-small text-text-secondary">
                  <span className="font-mono">{pendingTaskCount}</span> pending ·{" "}
                  <span className="font-mono">{completedTaskCount}</span> completed{" "}
                  {completedTaskCount === 1 ? "task" : "tasks"}
                </p>
              </div>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
