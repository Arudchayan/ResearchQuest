import { useCallback, useMemo, useState, type FormEvent } from "react";
import { CheckSquare, ChevronDown, ChevronUp, Plus, Target, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTasks } from "../../hooks/useTasks";
import { navigateToView } from "../../lib/softNavigation";
import { useTasksStore } from "../../store/tasksStore";
import { useShellStore } from "../../store/shellStore";
import {
  resolveTodayTasks,
  useTodayPlanStore,
} from "../../store/todayPlanStore";
import { todayKey } from "../../utils/time";
import { isOverdue } from "../tasks/TaskCard";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ListSkeleton } from "../ui/Skeleton";
import { InlineError } from "../ui/ErrorFallback";

interface TodayPlanProps {
  tasksLoading: boolean;
  tasksSyncError: { message: string } | null;
  onRetryTasks: () => void;
}

export function TodayPlan({
  tasksLoading,
  tasksSyncError,
  onRetryTasks,
}: TodayPlanProps) {
  const userId = useShellStore((state) => state.user?.id);
  const tasks = useTasksStore((state) => state.tasks);
  const setSelectedTask = useTasksStore((state) => state.setSelectedTask);
  const { createTask, completeTask } = useTasks(userId, { owner: false });
  const { orderedIds, pin, unpin, setOrder, setPendingFocusTaskId } = useTodayPlanStore(
    useShallow((state) => ({
      orderedIds: state.orderedIds,
      pin: state.pin,
      unpin: state.unpin,
      setOrder: state.setOrder,
      setPendingFocusTaskId: state.setPendingFocusTaskId,
    })),
  );
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const todayTasks = useMemo(
    () => resolveTodayTasks(tasks),
    [tasks, orderedIds],
  );
  const pinnedIds = useMemo(() => new Set(orderedIds), [orderedIds]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter(
        (task) => !task.completed && isOverdue(task.due_date),
      ),
    [tasks],
  );

  const handleAdd = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const title = draft.trim();
      if (!title || submitting) return;
      setSubmitting(true);
      try {
        const created = await createTask({
          title,
          due_date: todayKey(),
          priority: "medium",
        });
        if (created) {
          pin(created.id);
          setDraft("");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [createTask, draft, pin, submitting],
  );

  const persistVisibleOrder = useCallback(
    (visible: { id: string }[]) => {
      // Reorder must not implicitly pin pure due-today rows: only ids that
      // are already pinned join the persisted order.
      const pinned = new Set(useTodayPlanStore.getState().orderedIds);
      setOrder(visible.map((task) => task.id).filter((id) => pinned.has(id)));
    },
    [setOrder],
  );

  const moveVisible = useCallback(
    (taskId: string, direction: -1 | 1) => {
      const index = todayTasks.findIndex((task) => task.id === taskId);
      if (index < 0) return;
      const next = index + direction;
      if (next < 0 || next >= todayTasks.length) return;
      const reordered = [...todayTasks];
      const [removed] = reordered.splice(index, 1);
      if (!removed) return;
      reordered.splice(next, 0, removed);
      persistVisibleOrder(reordered);
    },
    [persistVisibleOrder, todayTasks],
  );

  const moveVisibleToIndex = useCallback(
    (taskId: string, toIndex: number) => {
      const from = todayTasks.findIndex((task) => task.id === taskId);
      if (from < 0) return;
      const bounded = Math.max(0, Math.min(toIndex, todayTasks.length - 1));
      if (from === bounded) {
        // No-op: persisting here would implicitly pin pure due-today rows.
        return;
      }
      const reordered = [...todayTasks];
      const [removed] = reordered.splice(from, 1);
      if (!removed) return;
      reordered.splice(bounded, 0, removed);
      persistVisibleOrder(reordered);
    },
    [persistVisibleOrder, todayTasks],
  );

  const handleToggleComplete = useCallback(
    (taskId: string, completed: boolean) => {
      // Completing removes the row from Today; drop the ghost id only once
      // completion commits — a failed write must keep its stored order.
      void completeTask(taskId).then((ok) => {
        if (ok && !completed) unpin(taskId);
      });
    },
    [completeTask, unpin],
  );

  const handleStartFocus = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      setSelectedTask(task);
      setPendingFocusTaskId(taskId);
      navigateToView("focus");
    },
    [setPendingFocusTaskId, setSelectedTask, tasks],
  );

  const handleOpenTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (task) setSelectedTask(task);
      navigateToView("tasks", `/tasks/${taskId}`);
    },
    [setSelectedTask, tasks],
  );

  return (
    <section aria-labelledby="today-heading">
      <Card className="p-5">
        <span className="font-mono text-caption text-text-tertiary">
          01 · TODAY
        </span>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border-subtle pb-2">
          <h2
            id="today-heading"
            className="font-serif text-body-lg font-bold text-text-primary"
          >
            Today
          </h2>
          <p className="text-small text-text-secondary">
            The list you will work through today
          </p>
        </div>

        {tasksSyncError && (
          <InlineError
            message={tasksSyncError.message}
            onRetry={onRetryTasks}
            className="mb-4"
          />
        )}

        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <label htmlFor="today-add-title" className="sr-only">
            Add what you will do today
          </label>
          <input
            id="today-add-title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Gym, CS homework, read a paper…"
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-border-moderate bg-bg-base px-3 text-small text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          />
          <Button type="submit" disabled={submitting || !draft.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </form>

        {todayTasks.length === 0 ? (
          tasksLoading ? (
            <ListSkeleton count={3} itemType="task" />
          ) : (
            <p className="text-small text-text-tertiary">
              Add what you&apos;ll do today. Due-today tasks land here
              automatically.
            </p>
          )
        ) : (
          <ol className="space-y-2">
            {todayTasks.map((task, index) => (
              <li
                key={task.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(task.id);
                  event.dataTransfer.setData("text/plain", task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId =
                    event.dataTransfer.getData("text/plain") || draggingId;
                  setDraggingId(null);
                  if (!sourceId || sourceId === task.id) return;
                  moveVisibleToIndex(sourceId, index);
                }}
                onDragEnd={() => setDraggingId(null)}
                className="flex items-center gap-2 p-2 hover:bg-bg-elevated"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  aria-label={`Mark complete: ${task.title}`}
                  onChange={() => {
                    handleToggleComplete(task.id, task.completed);
                  }}
                  className="h-4 w-4 shrink-0 accent-[var(--primary-500)]"
                />
                <button
                  type="button"
                  onClick={() => handleOpenTask(task.id)}
                  aria-label={`Open task: ${task.title}`}
                  className="min-w-0 flex-1 truncate text-left text-small font-medium text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                >
                  {task.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartFocus(task.id)}
                  aria-label={`Start focus: ${task.title}`}
                  className="shrink-0"
                >
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Focus
                </Button>
                {pinnedIds.has(task.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => unpin(task.id)}
                    aria-label={`Remove ${task.title} from Today`}
                    title="Remove from Today"
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Unpin
                  </Button>
                )}
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${task.title} up`}
                    disabled={index === 0}
                    onClick={() => {
                      moveVisible(task.id, -1);
                    }}
                    className="inline-flex min-h-6 min-w-8 items-center justify-center text-text-tertiary hover:text-text-primary disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${task.title} down`}
                    disabled={index === todayTasks.length - 1}
                    onClick={() => {
                      moveVisible(task.id, 1);
                    }}
                    className="inline-flex min-h-6 min-w-8 items-center justify-center text-text-tertiary hover:text-text-primary disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {overdueTasks.length > 0 && (
          <div className="mt-6 border-t border-border-subtle pt-4">
            <h3 className="mb-2 font-mono text-caption uppercase tracking-wider text-text-tertiary">
              Needs attention
            </h3>
            <ul className="space-y-1">
              {overdueTasks.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenTask(task.id)}
                    aria-label={`Open overdue task: ${task.title}`}
                    className="flex w-full items-center justify-between gap-3 p-2 text-left hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckSquare
                        className="h-4 w-4 shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <span className="truncate text-small text-text-primary">
                        {task.title}
                      </span>
                    </span>
                    <Badge variant="destructive" className="shrink-0 font-mono">
                      Overdue
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </section>
  );
}
