import { useState } from "react";
import type { MouseEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import type { Task } from "../../types/database";
import { parseDateInput } from "../../utils/time";
import { highlightMatch } from "../../utils/highlight";
import type { TaskPriority } from "./taskTypes";

const priorityBadgeVariants: Record<TaskPriority, BadgeVariant> = {
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

export function getPriorityColor(priority: TaskPriority): BadgeVariant {
  return priorityBadgeVariants[priority];
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

  const overdue = !task.completed && isOverdue(task.due_date);
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
    <Card
      className={`transition duration-fast ${
        task.completed
          ? "border-border-subtle bg-bg-elevated"
          : overdue
            ? "border-destructive hover:border-destructive hover:shadow-sm"
            : "hover:border-border-strong hover:shadow-sm"
      } ${compact ? "p-3" : "p-4"} ${isCompleting ? "scale-95" : ""}`}
    >
      <div className={`flex items-start ${compact ? "gap-2" : "gap-3"}`}>
        {/* Checkbox */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className={`mt-0.5 shrink-0 rounded-control transition-transform duration-fast ${
            isCompleting ? "scale-125" : ""
          }`}
          aria-label={
            task.completed ? "Mark task as incomplete" : "Mark task as complete"
          }
        >
          {task.completed ? (
            <CheckCircle2
              className="h-5 w-5 text-success"
              aria-hidden="true"
            />
          ) : (
            <Circle
              className="h-5 w-5 text-text-tertiary"
              aria-hidden="true"
            />
          )}
        </Button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={`flex flex-wrap items-start justify-between gap-2 ${compact ? "mb-1" : "mb-2"}`}
          >
            <h2
              className={`min-w-0 flex-1 break-words text-small font-semibold ${
                task.completed
                  ? "text-text-secondary line-through"
                  : "text-text-primary"
              }`}
            >
              {highlightMatch(task.title, highlightQuery)}
            </h2>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(task)}
                className="text-small"
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="text-text-tertiary hover:bg-destructive-bg hover:text-destructive"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {task.description && (
            <p
              className={`${compact ? "mb-2 text-caption" : "mb-3 text-small"} break-words ${task.completed ? "text-text-tertiary" : "text-text-secondary"}`}
            >
              {highlightMatch(task.description, highlightQuery)}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {/* Priority Badge */}
            <Badge variant={getPriorityColor(task.priority)} className="capitalize text-small">
              {task.priority}
            </Badge>

            {/* Category Badge */}
            {task.category && (
              <Badge variant="neutral" className="font-medium text-small">
                {task.category}
              </Badge>
            )}

            {/* Due Date */}
            {dueDate && (
              overdue ? (
                <Badge variant="priority-overdue" className="font-medium text-small">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>(Overdue)</span>
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 text-caption text-text-tertiary">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {dueDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
