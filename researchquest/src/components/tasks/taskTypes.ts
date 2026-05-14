export type TaskFilter = "all" | "pending" | "completed" | "overdue";
export type TaskPriority = "high" | "medium" | "low";
export type TaskCategory =
  | "Research"
  | "Reading"
  | "Writing"
  | "Analysis"
  | "Presentation";
export type SortOption = "due_date" | "priority" | "recent";

export const PRIORITIES: TaskPriority[] = ["high", "medium", "low"];
export const CATEGORIES: TaskCategory[] = [
  "Research",
  "Reading",
  "Writing",
  "Analysis",
  "Presentation",
];
export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
