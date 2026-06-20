import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import type { Task } from "../../types/database";
import { supabase } from "../../lib/supabase";
import { ListSkeleton } from "../ui/Skeleton";
import { FormDialog } from "../ui/FormDialog";
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
import { UNDO_WINDOW_MS } from "../../lib/constants";
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
  } = useTasks(userId);
  const tasksSyncError = useAppStore(
    (state) => state.dataSyncErrors?.tasks ?? null,
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

  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Task | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
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

  // Performance: Pre-compute searchable text fields
  // so that expensive string concatenation and toLowerCase operations are
  // decoupled from the fast keystroke filtering loop.
  const searchableTasks = useMemo(() => {
    return tasks.map((task) => ({
      task,
      searchText: [
        task.title,
        task.description ?? "",
        task.category ?? "",
        task.project_id ?? "",
        task.priority,
        task.completed ? "completed done" : "pending active",
        task.due_date ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [tasks]);

  const projectIdsInUse = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      const pid = t.project_id?.trim();
      if (pid) ids.add(pid);
    }
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    // Performance: Filter tasks inside the useMemo hook
    // to prevent the array from being recreated on every single render.
    // If filteredTasks was defined outside and passed as a dependency,
    // this useMemo would invalidate on every unrelated state change (like typing in an input).
    const normalizedQuery = searchQuery?.trim().toLowerCase() || "";

    let filtered;
    if (
      !normalizedQuery &&
      filter === "all" &&
      categoryFilter === "all" &&
      projectFilter === "all"
    ) {
      filtered = [...(tasks || [])];
    } else {
      filtered = [];
      const safeSearchableTasks = searchableTasks || [];
      for (let i = 0; i < safeSearchableTasks.length; i++) {
        const { task, searchText } = safeSearchableTasks[i];

        const matchesFilter =
          filter === "all" ||
          (filter === "pending" && !task.completed) ||
          (filter === "completed" && task.completed) ||
          (filter === "overdue" &&
            !task.completed &&
            isOverdue(task.due_date));

        if (!matchesFilter) {
          continue;
        }

        if (
          categoryFilter !== "all" &&
          (task.category || "") !== categoryFilter
        ) {
          continue;
        }

        if (
          projectFilter !== "all" &&
          (task.project_id || "") !== projectFilter
        ) {
          continue;
        }

        if (normalizedQuery && !searchText.includes(normalizedQuery)) {
          continue;
        }

        filtered.push(task);
      }
    }

    if (sortOption === "priority") {
      return filtered.sort((a, b) => {
        if (a.completed !== b.completed) {
          return Number(a.completed) - Number(b.completed);
        }
        const priorityDiff =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        // Performance: Use string comparison for ISO dates
        // instead of parsing Date objects inside the sort callback.
        const aDue = a.due_date || "9999-12-31";
        const bDue = b.due_date || "9999-12-31";
        if (aDue !== bDue) {
          return aDue > bDue ? 1 : -1;
        }
        return b.created_at > a.created_at ? 1 : -1;
      });
    }

    if (sortOption === "recent") {
      // Optimization: Use string comparison for ISO dates
      return filtered.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    }

    return filtered.sort((a, b) => {
      // Performance: Use string comparison for ISO dates
      // instead of parsing Date objects inside the sort callback.
      const aDue = a.due_date || "9999-12-31";
      const bDue = b.due_date || "9999-12-31";
      if (aDue !== bDue) {
        return aDue > bDue ? 1 : -1;
      }
      // Optimization: Use string comparison for ISO dates
      return a.created_at > b.created_at ? 1 : -1;
    });
  }, [
    searchableTasks,
    tasks,
    filter,
    searchQuery,
    sortOption,
    categoryFilter,
    projectFilter,
  ]);

  // Calculate progress
  // Compute aggregate statistics in a single O(N) pass inside useMemo.
  // This avoids chaining multiple .filter().length calls that create unnecessary
  // intermediate arrays and trigger redundant iterations during render.
  const { completedCount, totalCount } = useMemo(() => {
    let completed = 0;
    const total = tasks.length;
    for (let i = 0; i < total; i++) {
      if (tasks[i].completed) {
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
      description: formDescription || undefined,
      priority: formPriority,
      category: formCategory,
      due_date: formDueDate || undefined,
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
      description: formDescription || undefined,
      priority: formPriority,
      category: formCategory,
      due_date: formDueDate || undefined,
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

  const handleDeleteWithUndo = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const success = await deleteTask(taskId);

      if (success && task) {
        lastDeletedRef.current = task;
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        const toastId = toast.success("Task deleted", {
          description: "Undo within 6 seconds to restore it.",
          duration: UNDO_WINDOW_MS,
          action: {
            label: "Undo",
            onClick: async () => {
              if (lastDeletedRef.current) {
                await restoreTask(lastDeletedRef.current);
                lastDeletedRef.current = null;
                if (undoTimeoutRef.current) {
                  clearTimeout(undoTimeoutRef.current);
                  undoTimeoutRef.current = null;
                }
                toast.dismiss(toastId);
              }
            },
          },
        });

        undoTimeoutRef.current = setTimeout(() => {
          lastDeletedRef.current = null;
          toast.dismiss(toastId);
          undoTimeoutRef.current = null;
        }, UNDO_WINDOW_MS);
      }
    },
    [deleteTask, restoreTask, tasks],
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
    <div className="h-full flex flex-col bg-bg-base">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border-subtle bg-bg-surface">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title font-bold text-text-primary">
            Task Manager
          </h2>
          <div className="flex items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="px-4 py-2 bg-bg-surface border border-border-subtle text-text-secondary rounded-md hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center gap-2 font-medium text-small shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
                  title="Export tasks"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] bg-bg-surface rounded-lg shadow-lg border border-border-subtle p-1 z-50 animate-in fade-in-0 zoom-in-95"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    onSelect={() => handleExport("markdown")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-base hover:text-text-primary rounded-md cursor-pointer outline-none transition-colors"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-base hover:text-text-primary rounded-md cursor-pointer outline-none transition-colors"
                  >
                    <Table className="w-4 h-4" aria-hidden="true" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-base hover:text-text-primary rounded-md cursor-pointer outline-none transition-colors"
                  >
                    <FileJson className="w-4 h-4" aria-hidden="true" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              New Task
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-small text-text-secondary">
                {completedCount} of {totalCount} tasks completed
              </span>
              <span className="text-small font-semibold text-primary-500">
                {progressPercentage}%
              </span>
            </div>
            <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters & search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "completed", "overdue"] as TaskFilter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-caption font-medium transition-colors capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 ${
                    filter === f
                      ? "bg-primary-500 text-white"
                      : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {f}
                </button>
              ),
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <label htmlFor="task-filter-category" className="sr-only">
              Filter by category
            </label>
            <select
              id="task-filter-category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as "all" | TaskCategory)
              }
              className="px-3 py-1.5 bg-bg-base border border-border-subtle rounded-md text-caption focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="px-3 py-1.5 bg-bg-base border border-border-subtle rounded-md text-caption focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-[14rem]"
            >
              <option value="all">All projects</option>
              {projectIdsInUse.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative w-full sm:w-64">
              <label htmlFor="task-search-input" className="sr-only">
                Search tasks
              </label>
              <SearchIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                aria-hidden="true"
              />
              <input
                id="task-search-input"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="w-full pl-9 pr-8 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-elevated rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="task-sort"
                className="text-caption text-text-tertiary"
              >
                Sort by
              </label>
              <select
                id="task-sort"
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value as SortOption)
                }
                className="px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 capitalize"
              >
                <option value="due_date">Due date</option>
                <option value="priority">Priority</option>
                <option value="recent">Recently added</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setCompactView((prev) => !prev)}
              aria-pressed={compactView}
              className={`px-3 py-2 rounded-md border text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2 ${
                compactView
                  ? "bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-500/20 dark:text-primary-200"
                  : "bg-bg-base text-text-secondary border-border-subtle hover:text-text-primary"
              }`}
            >
              {compactView ? "Comfortable view" : "Compact view"}
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      {tasksSyncError && <InlineError message={tasksSyncError.message} />}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {sortedTasks.length === 0 ? (
          <>
          <div className="sr-only" role="status" aria-live="polite">
            {searchQuery ? "No matches found. Try a different keyword or clear your search." : "No tasks match your filters. Create a new task or adjust filters to see more items."}
          </div>
          <div className="text-center py-16">
            <CheckCircle2
              className="w-16 h-16 mx-auto mb-4 text-text-tertiary opacity-50"
              aria-hidden="true"
            />
            <p className="text-body text-text-secondary mb-2">
              {searchQuery ? "No matches found" : "No tasks match your filters"}
            </p>
            <p className="text-small text-text-tertiary mb-4">
              {searchQuery ? "Try a different keyword or clear your search." : "Create a new task or adjust filters to see more items."}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              New Task
            </button>
          </div>
          </>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditClick}
                onDelete={handleDeleteWithUndo}
                compact={compactView}
                highlightQuery={searchQuery}
              />
            ))}
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
            className="w-6 h-6 text-primary-600 dark:text-primary-400"
            aria-hidden="true"
          />
        }
        submitText={editingTask ? "Update" : "Create"}
        isSubmitDisabled={!formTitle.trim()}
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-small font-medium text-text-primary mb-2"
            >
              Title
            </label>
            <input
              id="task-title"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-small font-medium text-text-primary mb-2"
            >
              Description (Optional)
            </label>
            <textarea
              id="task-description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px] resize-y"
              placeholder="Add more details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label
                htmlFor="task-priority"
                className="block text-small font-medium text-text-primary mb-2"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={formPriority}
                onChange={(e) =>
                  setFormPriority(e.target.value as TaskPriority)
                }
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 capitalize"
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
              <label
                htmlFor="task-category"
                className="block text-small font-medium text-text-primary mb-2"
              >
                Category
              </label>
              <select
                id="task-category"
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as TaskCategory)
                }
                className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label
              htmlFor="task-due-date"
              className="block text-small font-medium text-text-primary mb-2"
            >
              Due Date
            </label>
            <input
              id="task-due-date"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

