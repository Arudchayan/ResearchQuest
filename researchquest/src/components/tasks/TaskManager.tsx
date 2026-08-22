import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useFilteredList } from "../../hooks/useFilteredList";
import {
  CheckCircle2,
  Plus,
  Search as SearchIcon,
  X,
  Download,
  FileText,
  Table,
  FileJson,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTasks } from "../../hooks/useTasks";
import { useUndoDelete } from "../../hooks/useUndoDelete";
import type { Task } from "../../types/database";
import { supabase } from "../../lib/supabase";
import { ListSkeleton } from "../ui/Skeleton";
import { FormDialog } from "../ui/FormDialog";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/EmptyState";
import {
  convertTasksToCSV,
  convertTasksToJSON,
  convertTasksToMarkdown,
  downloadFile,
} from "../../utils/export";
import { logger } from "../../utils/logger";
import { toast } from "sonner";
import { useAppStore } from "../../store/appStore";
import { InlineError } from "../ui/ErrorFallback";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PageHeader } from "../ui/PageHeader";
import type { TaskFilter, TaskPriority, TaskCategory, SortOption } from "./taskTypes";
import { PRIORITIES, CATEGORIES, PRIORITY_ORDER } from "./taskTypes";
import { TaskCard, isOverdue } from "./TaskCard";

export function TaskManager() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const {
    tasks,
    loading,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    restoreTask,
  } = useTasks(userId, { owner: false });
  const tasksSyncError = useAppStore(
    (state) => state.dataSyncErrors?.tasks ?? null,
  );
  const selectedTaskId = useAppStore(
    (state) => state.selectedTask?.id ?? null,
  );

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TaskCategory>(
    "all",
  );
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("due_date");
  const [compactView, setCompactView] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Scrolls the deep-linked (selected) task card into view whenever it is
  // attached to the list — covers both initial navigation and re-appearing
  // after a filter/search change. Stable callback: only fires on attach.
  const handleSelectedCardRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, []);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formCategory, setFormCategory] = useState<TaskCategory>("Research");
  const [formDueDate, setFormDueDate] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  const projectIdsInUse = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      const pid = t.project_id?.trim();
      if (pid) ids.add(pid);
    }
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const sortedTasks = useFilteredList(
    tasks,
    searchQuery,
    useCallback((task: Task) => [
      task.title,
      task.description ?? "",
      task.category ?? "",
      task.project_id ?? "",
      task.priority,
      task.completed ? "completed done" : "pending active",
      task.due_date ?? "",
    ].join(" "), []),
    useCallback((a: Task, b: Task) => {
      if (sortOption === "priority") {
        if (a.completed !== b.completed) {
          return Number(a.completed) - Number(b.completed);
        }
        const priorityDiff =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        // ⚡ PERFORMANCE OPTIMIZATION: Use string comparison for ISO dates
        // instead of parsing Date objects inside the sort callback.
        const aDue = a.due_date || "9999-12-31";
        const bDue = b.due_date || "9999-12-31";
        if (aDue !== bDue) {
          return aDue > bDue ? 1 : -1;
        }
        return b.created_at > a.created_at ? 1 : -1;
      }

      if (sortOption === "recent") {
        // Optimization: Use string comparison for ISO dates
        return b.created_at > a.created_at ? 1 : -1;
      }

      // Optimization: Use string comparison for ISO dates
      const aDue = a.due_date || "9999-12-31";
      const bDue = b.due_date || "9999-12-31";
      if (aDue !== bDue) {
        return aDue > bDue ? 1 : -1;
      }
      return a.created_at > b.created_at ? 1 : -1;
    }, [sortOption]),
    useCallback((task: Task) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && !task.completed) ||
        (filter === "completed" && task.completed) ||
        (filter === "overdue" && !task.completed && isOverdue(task.due_date));
      if (!matchesFilter) return false;

      if (categoryFilter !== "all" && (task.category || "") !== categoryFilter) return false;
      if (projectFilter !== "all" && (task.project_id || "") !== projectFilter) return false;

      return true;
    }, [filter, categoryFilter, projectFilter]),
  );

  // Calculate progress
  // ⚡ PERFORMANCE OPTIMIZATION:
  // Compute aggregate statistics in a single O(N) pass inside useMemo.
  // This avoids chaining multiple .filter().length calls that create unnecessary
  // intermediate arrays and trigger redundant iterations during render.
  const { completedCount, totalCount } = useMemo(() => {
    let completed = 0;
    const total = tasks.length;
    for (const t of tasks) {
      if (t.completed) {
        completed++;
      }
    }
    return { completedCount: completed, totalCount: total };
  }, [tasks]);
  const progressPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddTask = async () => {
    if (!formTitle.trim()) return;

    await createTask({
      title: formTitle,
      ...(formDescription ? { description: formDescription } : {}),
      priority: formPriority,
      category: formCategory,
      ...(formDueDate ? { due_date: formDueDate } : {}),
    });

    // Reset form
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormCategory("Research");
    setFormDueDate("");
    setShowAddModal(false);
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !formTitle.trim()) return;

    await updateTask(editingTask.id, {
      title: formTitle,
      ...(formDescription ? { description: formDescription } : {}),
      priority: formPriority,
      category: formCategory,
      ...(formDueDate ? { due_date: formDueDate } : {}),
    });

    // Reset form
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormCategory("Research");
    setFormDueDate("");
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormPriority(task.priority);
    setFormCategory((task.category as TaskCategory) || "Research");
    setFormDueDate(task.due_date || "");
  };

  const handleToggleComplete = async (task: Task) => {
    await completeTask(task.id);
  };

  const { handleDeleteWithUndo } = useUndoDelete(
    (task: Task) => deleteTask(task.id),
    (task: Task) => restoreTask(task),
    { entityLabel: "Task" },
  );

  const handleCancelEdit = () => {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormPriority("medium");
    setFormCategory("Research");
    setFormDueDate("");
  };

  const handleExport = (format: "markdown" | "csv" | "json") => {
    if (sortedTasks.length === 0) {
      toast.error("No tasks to export");
      return;
    }

    const timestamp = new Date().toISOString().split("T")[0];
    let content = "";
    let filename = "";
    let type = "";

    try {
      switch (format) {
        case "markdown":
          content = convertTasksToMarkdown(sortedTasks);
          filename = `research-tasks-${timestamp}.md`;
          type = "text/markdown";
          break;
        case "csv":
          content = convertTasksToCSV(sortedTasks);
          filename = `research-tasks-${timestamp}.csv`;
          type = "text/csv";
          break;
        case "json":
          content = convertTasksToJSON(sortedTasks);
          filename = `research-tasks-${timestamp}.json`;
          type = "application/json";
          break;
      }

      downloadFile(content, filename, type);
      toast.success(
        `Exported ${sortedTasks.length} tasks as ${format.toUpperCase()}`,
      );
    } catch (err) {
      logger.error("Export failed", err);
      toast.error("Failed to export tasks");
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <ListSkeleton count={6} itemType="task" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base">
      <PageHeader
        className="bg-bg-surface"
        title="Task Manager"
        actions={
          <>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="outline" title="Export tasks">
                  <Download aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-dropdown min-w-[180px] rounded-surface border border-border-subtle bg-bg-surface p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("markdown")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                  >
                    <Table className="h-4 w-4" aria-hidden="true" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-small text-text-primary outline-none hover:bg-bg-elevated focus:bg-bg-elevated"
                  >
                    <FileJson className="h-4 w-4" aria-hidden="true" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button type="button" onClick={() => setShowAddModal(true)}>
              <Plus aria-hidden="true" />
              New Task
            </Button>
          </>
        }
      />

      <div className="border-b border-border-subtle bg-bg-surface p-4 sm:p-6">
        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mb-4" aria-label="Task completion progress">
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-small text-text-secondary">
                {completedCount} of {totalCount} tasks completed
              </span>
              <span className="font-mono text-small font-semibold tabular-nums text-primary-500">
                {progressPercentage}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercentage}
              aria-label="Task completion progress"
            >
              <div
                className="h-full bg-primary-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters & search */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" aria-label="Task status filters">
            {(["all", "pending", "completed", "overdue"] as TaskFilter[]).map(
              (f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={filter === f ? "default" : "secondary"}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className="min-w-11 text-small capitalize md:min-h-10"
                >
                  {f}
                </Button>
              ),
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="task-filter-category" className="sr-only">
                Filter by category
              </label>
              <select
                id="task-filter-category"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as "all" | TaskCategory)
                }
                className="min-h-11 rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus md:min-h-0"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label htmlFor="task-filter-project" className="sr-only">
                Filter by project
              </label>
              <select
                id="task-filter-project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="min-h-11 max-w-full rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus sm:max-w-56 md:min-h-0"
              >
                <option value="all">All projects</option>
                {projectIdsInUse.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:min-w-64">
                <label htmlFor="task-search-input" className="sr-only">
                  Search tasks
                </label>
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                  aria-hidden="true"
                />
                <Input
                  id="task-search-input"
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  className="bg-bg-base pl-10 pr-12 text-small"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full text-text-tertiary hover:text-text-primary"
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <label htmlFor="task-sort" className="text-small text-text-tertiary">
                  Sort by
                </label>
                <select
                  id="task-sort"
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                  className="min-h-11 rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus md:min-h-0"
                >
                  <option value="due_date">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="recent">Recently added</option>
                </select>
              </div>

              <Button
                type="button"
                size="sm"
                variant={compactView ? "secondary" : "outline"}
                onClick={() => setCompactView((prev) => !prev)}
                aria-pressed={compactView}
                className="shrink-0 text-small"
              >
                {compactView ? "Comfortable view" : "Compact view"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      {tasksSyncError && (
        <InlineError
          message={tasksSyncError.message}
          className="mx-4 mt-4 sm:mx-6"
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {sortedTasks.length === 0 ? (
          <EmptyState
            className="min-h-64 py-16"
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={searchQuery ? "No matches found" : "No tasks match your filters"}
            description={
              searchQuery
                ? "Try a different keyword or clear your search."
                : "Create a new task or adjust filters to see more items."
            }
            action={
              <Button type="button" onClick={() => setShowAddModal(true)}>
                <Plus aria-hidden="true" />
                New Task
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task) => {
              const isSelected =
                selectedTaskId != null && task.id === selectedTaskId;
              return (
                <div
                  key={task.id}
                  ref={isSelected ? handleSelectedCardRef : undefined}
                  className={
                    isSelected
                      ? "rounded-surface ring-2 ring-primary-500"
                      : undefined
                  }
                >
                  <TaskCard
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEditClick}
                    onDelete={() => void handleDeleteWithUndo(task)}
                    compact={compactView}
                    highlightQuery={searchQuery}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <FormDialog
        isOpen={showAddModal || editingTask !== null}
        onClose={() => {
          setShowAddModal(false);
          handleCancelEdit();
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (editingTask) {
            handleUpdateTask();
          } else {
            handleAddTask();
          }
        }}
        title={editingTask ? "Edit Task" : "New Task"}
        icon={
          <CheckCircle2
            className="h-6 w-6 text-primary-500"
            aria-hidden="true"
          />
        }
        submitText={editingTask ? "Update" : "Create"}
        isSubmitDisabled={!formTitle.trim()}
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label
              htmlFor="task-title"
              className="mb-2 block text-small font-medium text-text-primary"
            >
              Title
            </Label>
            <Input
              id="task-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-bg-base text-small"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <Label
              htmlFor="task-description"
              className="mb-2 block text-small font-medium text-text-primary"
            >
              Description (Optional)
            </Label>
            <textarea
              id="task-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="min-h-20 w-full resize-y rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              placeholder="Add more details..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Priority */}
            <div>
              <Label
                htmlFor="task-priority"
                className="mb-2 block text-small font-medium text-text-primary"
              >
                Priority
              </Label>
              <select
                id="task-priority"
                value={formPriority}
                onChange={(e) =>
                  setFormPriority(e.target.value as TaskPriority)
                }
                className="min-h-11 w-full rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus capitalize md:min-h-0"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <Label
                htmlFor="task-category"
                className="mb-2 block text-small font-medium text-text-primary"
              >
                Category
              </Label>
              <select
                id="task-category"
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as TaskCategory)
                }
                className="min-h-11 w-full rounded-control border border-border-moderate bg-bg-base px-3 py-2 text-small text-text-primary focus:outline-none focus:ring-2 focus:ring-focus md:min-h-0"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <Label
              htmlFor="task-due-date"
              className="mb-2 block text-small font-medium text-text-primary"
            >
              Due Date
            </Label>
            <Input
              id="task-due-date"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="bg-bg-base text-small"
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

