import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { MouseEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Trash2,
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
import type { Task } from "../../hooks/useTasks";
import { supabase } from "../../lib/supabase";
import { parseDateInput } from "../../utils/time";
import { ListSkeleton } from "../ui/Skeleton";
import { FormDialog } from "../ui/FormDialog";
import { highlightMatch } from "../../utils/highlight";
import {
  convertTasksToCSV,
  convertTasksToJSON,
  convertTasksToMarkdown,
  downloadFile,
} from "../../utils/export";
import { logger } from "../../utils/logger";
import { toast } from "sonner";

type TaskFilter = "all" | "pending" | "completed" | "overdue";
type TaskPriority = "high" | "medium" | "low";
type TaskCategory =
  | "Research"
  | "Reading"
  | "Writing"
  | "Analysis"
  | "Presentation";
type SortOption = "due_date" | "priority" | "recent";

const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
const CATEGORIES: TaskCategory[] = [
  "Research",
  "Reading",
  "Writing",
  "Analysis",
  "Presentation",
];
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "high":
      return "bg-red-500/15 text-red-700 border border-red-500/30 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800";
    case "medium":
      return "bg-amber-400/20 text-amber-700 border border-amber-500/30 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800";
    case "low":
      return "bg-emerald-400/20 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800";
  }
}

function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const parsed = parseDateInput(dueDate);
  if (!parsed) return false;
  const now = new Date();
  // Treat tasks as overdue only after the day has passed
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < now.getTime();
}

export function TaskManager() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { tasks, loading, createTask, updateTask, completeTask, deleteTask, restoreTask } =
    useTasks(userId);

  const [filter, setFilter] = useState<TaskFilter>("all");
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

  // Filter tasks
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTasks = tasks.filter((task) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && !task.completed) ||
      (filter === "completed" && task.completed) ||
      (filter === "overdue" && !task.completed && isOverdue(task.due_date));

    if (!matchesFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      task.title,
      task.description ?? "",
      task.category ?? "",
      task.priority,
      task.completed ? "completed done" : "pending active",
      task.due_date ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];

    if (sortOption === "priority") {
      return list.sort((a, b) => {
        if (a.completed !== b.completed) {
          return Number(a.completed) - Number(b.completed);
        }
        const priorityDiff =
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        const aDue = parseDateInput(a.due_date)?.getTime() ?? Infinity;
        const bDue = parseDateInput(b.due_date)?.getTime() ?? Infinity;
        if (aDue !== bDue) {
          return aDue - bDue;
        }
        // Optimization: Use string comparison for ISO dates
        return b.created_at > a.created_at ? 1 : -1;
      });
    }

    if (sortOption === "recent") {
      // Optimization: Use string comparison for ISO dates
      return list.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    }

    return list.sort((a, b) => {
      const aDue = parseDateInput(a.due_date)?.getTime() ?? Infinity;
      const bDue = parseDateInput(b.due_date)?.getTime() ?? Infinity;
      if (aDue !== bDue) {
        return aDue - bDue;
      }
      // Optimization: Use string comparison for ISO dates
      return a.created_at > b.created_at ? 1 : -1;
    });
  }, [filteredTasks, sortOption]);

  // Calculate progress
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
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
          duration: 6000,
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
        }, 6000);
      }
    },
    [deleteTask, restoreTask, tasks]
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
        `Exported ${sortedTasks.length} tasks as ${format.toUpperCase()}`
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
                  className="px-4 py-2 bg-bg-surface border border-border-subtle text-text-secondary rounded-md hover:bg-bg-elevated hover:text-text-primary transition-colors flex items-center gap-2 font-medium text-small shadow-sm"
                  title="Export tasks"
                >
                  <Download className="w-4 h-4" />
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
                    <FileText className="w-4 h-4" />
                    Markdown (.md)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("csv")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-base hover:text-text-primary rounded-md cursor-pointer outline-none transition-colors"
                  >
                    <Table className="w-4 h-4" />
                    CSV (.csv)
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => handleExport("json")}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-base hover:text-text-primary rounded-md cursor-pointer outline-none transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    JSON (.json)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
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
                  className={`px-3 py-1.5 rounded-md text-caption font-medium transition-colors capitalize ${
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
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
                  onClick={() => {
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
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
              className={`px-3 py-2 rounded-md border text-small font-medium transition-colors ${
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-text-tertiary opacity-50" />
            <p className="text-body text-text-secondary mb-2">
              No tasks match your filters
            </p>
            <p className="text-small text-text-tertiary mb-4">
              Create a new task or adjust filters to see more items.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
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
          if (editingTask) { handleUpdateTask(); } else { handleAddTask(); }
        }}
        title={editingTask ? "Edit Task" : "New Task"}
        icon={<CheckCircle2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />}
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

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  highlightQuery?: string;
}

function TaskCard({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  compact = false,
  highlightQuery = "",
}: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  const overdue = isOverdue(task.due_date);
  const dueDate = task.due_date ? parseDateInput(task.due_date) : null;

  const handleToggle = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!task.completed) {
      setIsCompleting(true);
      setTimeout(() => setIsCompleting(false), 600);
    }
    await onToggleComplete(task);
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  return (
    <div
      className={`relative rounded-lg border bg-bg-surface transition-all duration-300 ${
        compact ? "p-3 sm:p-3.5" : "p-4"
      } ${
        task.completed
          ? "border-border-subtle opacity-60"
          : overdue
            ? "border-red-200 dark:border-red-900"
            : "border-border-subtle hover:border-border-moderate hover:shadow-sm"
      } ${isCompleting ? "scale-95 opacity-50" : ""}`}
    >
      <div className={`flex items-start ${compact ? "gap-2.5" : "gap-3"}`}>
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 mt-0.5 transition-all duration-200 ${
            isCompleting ? "scale-125" : ""
          }`}
          aria-label={
            task.completed ? "Mark task as incomplete" : "Mark task as complete"
          }
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 animate-in fade-in zoom-in duration-300" />
          ) : (
            <Circle className="w-5 h-5 text-text-tertiary hover:text-primary-500" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`flex items-start justify-between gap-2 ${compact ? "mb-1.5" : "mb-2"}`}
          >
            <h4
              className={`text-small font-semibold ${
                task.completed
                  ? "text-text-tertiary line-through"
                  : "text-text-primary"
              }`}
            >
              {highlightMatch(task.title, highlightQuery)}
            </h4>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onEdit(task)}
                className="px-2 py-1 rounded-md border text-caption font-medium transition-colors text-text-secondary border-border-subtle hover:border-primary-400 hover:text-primary-600"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded transition-colors text-text-tertiary hover:text-red-500"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {task.description && (
            <p
              className={`${compact ? "text-caption mb-2" : "text-small mb-3"} text-text-secondary`}
            >
              {highlightMatch(task.description, highlightQuery)}
            </p>
          )}

          {/* Metadata */}
          <div
            className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}
          >
            {/* Priority Badge */}
            <span
              className={`px-2 py-0.5 rounded-full text-caption font-semibold capitalize ${getPriorityColor(task.priority)}`}
            >
              {task.priority}
            </span>

            {/* Category Badge */}
            {task.category && (
              <span
                className={`px-2 py-0.5 rounded-full text-caption font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ${compact ? "border border-blue-200/80 dark:border-blue-800/80" : ""}`}
              >
                {task.category}
              </span>
            )}

            {/* Due Date */}
            {dueDate && (
              <div
                className={`flex items-center gap-1 text-caption ${
                  overdue && !task.completed
                    ? "text-red-600 dark:text-red-400 font-semibold"
                    : "text-text-tertiary"
                }`}
              >
                {overdue && !task.completed ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span>
                  {dueDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {overdue && !task.completed && (
                  <span className="font-semibold">(Overdue)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
