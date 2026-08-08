import { useState } from "react";
import type { MouseEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import type { Task } from "../../types/database";
import { parseDateInput } from "../../utils/time";
import { highlightMatch } from "../../utils/highlight";
import type { TaskPriority } from "./taskTypes";

export function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "high":
      return "bg-coral-soft text-coral-strong border border-coral/25";
    case "medium":
      return "bg-gold-soft text-gold-strong border border-gold/25";
    case "low":
      return "bg-blue-soft text-blue-strong border border-blue/25";
  }
}

export function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const parsed = parseDateInput(dueDate);
  if (!parsed) return false;
  const now = new Date();
  // Treat tasks as overdue only after the day has passed
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < now.getTime();
}

export interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  highlightQuery?: string;
}

export function TaskCard({
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
      className={`surface-card relative transition-all duration-300 ${
        compact ? "p-3 sm:p-3.5" : "p-4"
      } ${
        task.completed
          ? "bg-success-bg opacity-70"
          : overdue
            ? "border-coral"
            : ""
      } ${isCompleting ? "scale-95 opacity-50" : ""}`}
    >
      <div className={`flex items-start ${compact ? "gap-2.5" : "gap-3"}`}>
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 mt-0.5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-full ${
            isCompleting ? "scale-125" : ""
          }`}
          aria-label={
            task.completed ? "Mark task as incomplete" : "Mark task as complete"
          }
        >
          {task.completed ? (
            <CheckCircle2
              className="w-5 h-5 text-success animate-in fade-in zoom-in duration-300"
              aria-hidden="true"
            />
          ) : (
            <Circle
              className="w-5 h-5 text-text-tertiary hover:text-accent"
              aria-hidden="true"
            />
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
                className="px-2 py-1 rounded-md border text-caption font-medium transition-colors text-text-secondary border-border-subtle hover:border-border-moderate hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded transition-colors text-text-tertiary hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
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
              className={`status-chip capitalize ${getPriorityColor(task.priority)}`}
            >
              {task.priority}
            </span>

            {/* Category Badge */}
            {task.category && (
              <span
                className="status-chip bg-bg-elevated text-text-secondary"
              >
                {task.category}
              </span>
            )}

            {/* Due Date */}
            {dueDate && (
              <div
                className={`flex items-center gap-1 text-caption ${
                  overdue && !task.completed
                    ? "text-coral-strong font-semibold"
                    : "text-text-tertiary"
                }`}
              >
                {overdue && !task.completed ? (
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <Clock className="w-3 h-3" aria-hidden="true" />
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
