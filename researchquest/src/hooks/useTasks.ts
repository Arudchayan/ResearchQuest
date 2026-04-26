import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { awardXP, XP_REWARDS } from "../utils/gamification";
import { toast } from "sonner";
import { parseDateInput } from "../utils/time";
import { logger } from "../utils/logger";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  due_date?: string;
  completed: boolean;
  category?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortTasksByDueDate = useCallback((taskList: Task[]) => {
    // ⚡ PERFORMANCE OPTIMIZATION:
    // Implement Schwartzian transform to avoid O(N log N) Date parsing overhead during sort
    const mapped = taskList.map((task) => {
      const parsedDate = parseDateInput(task.due_date);
      return {
        task,
        dueTime: parsedDate ? parsedDate.getTime() : null,
      };
    });

    mapped.sort((a, b) => {
      const aDue = a.dueTime;
      const bDue = b.dueTime;

      if (aDue === null && bDue === null) {
        return a.task.created_at > b.task.created_at ? 1 : -1;
      }
      if (aDue === null) return 1;
      if (bDue === null) return -1;
      if (aDue === bDue) {
        return a.task.created_at > b.task.created_at ? 1 : -1;
      }
      return aDue - bDue;
    });

    return mapped.map((m) => m.task);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;

    const { data, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (fetchError) {
      setError("Failed to fetch tasks");
    } else {
      setTasks(sortTasksByDueDate(data || []));
    }
    setLoading(false);
  }, [userId, sortTasksByDueDate]);

  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    fetchTasks();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`tasks_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.log("Tasks realtime update:", payload);
          // Optimistic UI update based on event type
          if (payload.eventType === "INSERT") {
            // Check if task already exists (from optimistic update) to avoid duplicates
            setTasks((prev) => {
              const exists = prev.some(
                (t) => t.id === (payload.new as Task).id,
              );
              if (exists) {
                logger.log(
                  "Task already exists (from optimistic update), skipping realtime insert",
                );
                return prev;
              }
              return sortTasksByDueDate([...(prev ?? []), payload.new as Task]);
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.new.id ? (payload.new as Task) : task,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) =>
              prev.filter((task) => task.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe((status) => {
        logger.log("Tasks subscription status:", status);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchTasks, sortTasksByDueDate, userId]);

  async function createTask(taskData: Partial<Task>): Promise<Task | null> {
    if (!userId) {
      setError("User not authenticated");
      toast.error("You must be logged in to create tasks");
      return null;
    }

    // Validate required fields
    if (!taskData.title || !taskData.title.trim()) {
      setError("Task title is required");
      toast.error("Task title is required");
      return null;
    }

    if (taskData.title.length > 255) {
      setError("Task title exceeds 255 characters");
      toast.error("Task title is too long");
      return null;
    }

    if (taskData.description && taskData.description.length > 1000) {
      setError("Task description exceeds 1000 characters");
      toast.error("Task description is too long");
      return null;
    }

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      title: taskData.title.trim(),
      completed: false,
      priority: taskData.priority || "medium",
    };

    // Only add optional fields if they have values (and trim strings)
    if (taskData.description && taskData.description.trim()) {
      cleanData.description = taskData.description.trim();
    }
    if (taskData.due_date && taskData.due_date.trim()) {
      const normalized = parseDateInput(taskData.due_date.trim());
      cleanData.due_date = normalized
        ? `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`
        : taskData.due_date.trim();
    }
    if (taskData.category && taskData.category.trim()) {
      cleanData.category = taskData.category.trim();
    }
    if (taskData.project_id && taskData.project_id.trim()) {
      cleanData.project_id = taskData.project_id.trim();
    }

    logger.log("Creating task with cleaned data:", cleanData);

    const { data, error: createError } = await supabase
      .from("tasks")
      .insert(cleanData)
      .select()
      .single();

    if (createError) {
      // Sentinel: Prevent information leakage by logging only the message
      logger.error("Failed to create task", createError);

      setError("Failed to create task. Please try again.");
      toast.error("Failed to create task. Please try again.");
      return null;
    }

    logger.log("Task created successfully:", data);
    toast.success("Task created successfully");

    // Optimistic update - add to local state immediately
    setTasks((prev) => sortTasksByDueDate([...(prev ?? []), data]));

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_TASK, "create_task").catch((e) =>
      logger.error("Failed to award XP", e),
    );

    void fetchTasks();

    return data;
  }

  async function updateTask(
    taskId: string,
    updates: Partial<Task>,
  ): Promise<boolean> {
    if (updates.title && updates.title.length > 255) {
      setError("Task title exceeds 255 characters");
      toast.error("Task title is too long");
      return false;
    }

    if (updates.description && updates.description.length > 1000) {
      setError("Task description exceeds 1000 characters");
      toast.error("Task description is too long");
      return false;
    }

    // Optimistic update
    const sanitizedUpdates: Partial<Task> = { ...updates };
    if (typeof sanitizedUpdates.due_date === "string") {
      const normalized = parseDateInput(sanitizedUpdates.due_date);
      sanitizedUpdates.due_date = normalized
        ? `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`
        : sanitizedUpdates.due_date;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...sanitizedUpdates,
              updated_at: new Date().toISOString(),
            }
          : task,
      ),
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update(sanitizedUpdates)
      .eq("id", taskId)
      .eq("user_id", userId);

    if (updateError) {
      // Sentinel: Prevent information leakage
      logger.error("Failed to update task", updateError);

      setError("Failed to update task. Please try again.");
      toast.error("Failed to update task. Please try again.");
      // Revert on error
      fetchTasks();
      return false;
    }

    void fetchTasks();
    return true;
  }

  async function completeTask(taskId: string): Promise<boolean> {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    // Toggle completion status
    const newCompletedStatus = !task.completed;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: newCompletedStatus,
              updated_at: new Date().toISOString(),
            }
          : t,
      ),
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ completed: newCompletedStatus })
      .eq("id", taskId)
      .eq("user_id", userId);

    if (updateError) {
      // Sentinel: Prevent information leakage
      logger.error("Failed to complete/uncomplete task", updateError);

      setError("Failed to update task. Please try again.");
      toast.error("Failed to update task. Please try again.");
      // Revert on error
      fetchTasks();
      return false;
    }

    if (newCompletedStatus) {
      toast.success("Task completed! 🎉");
    }

    // Award XP only when completing (not un-completing, don't await to avoid blocking)
    if (newCompletedStatus && userId) {
      awardXP(userId, XP_REWARDS.COMPLETE_TASK, "complete_task").catch((e) =>
        logger.error("Failed to award XP", e),
      );
    }

    void fetchTasks();
    return true;
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    // Optimistic delete
    const deletedTask = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (deleteError) {
      // Sentinel: Prevent information leakage
      logger.error("Failed to delete task", deleteError);

      setError("Failed to delete task. Please try again.");
      toast.error("Failed to delete task. Please try again.");
      // Revert on error
      if (deletedTask) {
        setTasks((prev) => [...prev, deletedTask]);
      }
      return false;
    }

    void fetchTasks();
    return true;
  }

  async function clearCompletedTasks(): Promise<boolean> {
    if (!userId) return false;

    // Optimistic delete
    const completedTasks = tasks.filter((t) => t.completed);
    if (completedTasks.length === 0) return true;

    setTasks((prev) => prev.filter((task) => !task.completed));

    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .eq("completed", true);

    if (deleteError) {
      // Sentinel: Prevent information leakage
      logger.error("Failed to clear completed tasks", deleteError);
      setError("Failed to clear completed tasks. Please try again.");
      toast.error("Failed to clear completed tasks. Please try again.");
      // Revert on error
      fetchTasks();
      return false;
    }

    void fetchTasks();
    return true;
  }

  async function restoreTask(task: Task): Promise<Task | null> {
    if (!userId) return null;

    // Optimistic restore
    setTasks((prev) => sortTasksByDueDate([...(prev ?? []), task]));

    const { data, error: restoreError } = await supabase
      .from("tasks")
      .insert(task)
      .select()
      .single();

    if (restoreError) {
      logger.error("Failed to restore task", restoreError);
      setError("Failed to restore task. Please try again.");
      toast.error("Failed to restore task");

      // Revert optimistic update
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      return null;
    }

    toast.success("Task restored");
    void fetchTasks();
    return data;
  }

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    clearCompletedTasks,
    restoreTask,
    refreshTasks: fetchTasks,
  };
}
