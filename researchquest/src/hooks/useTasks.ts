/**
 * OWNERSHIP: tasks (sole owner)
 *
 * This hook is the exclusive realtime owner for the tasks table. It manages
 * all CRUD operations, the canonical Zustand task collection, optimistic
 * updates, and the Postgres realtime subscription for tasks.
 *
 * No other hook should subscribe to "tasks" for data ownership purposes.
 * Sidebar stats (right_sidebar_tasks) refresh deadline counts only.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { awardXP, notifyGamificationResult, XP_REWARDS } from "../utils/gamification";
import { toast } from "sonner";
import { parseDateInput } from "../utils/time";
import { logger } from "../utils/logger";
import { useAppStore } from "../store/appStore";
import type { Task } from "../types/database";

export type { Task } from "../types/database";

export interface UseTasksOptions {
  owner?: boolean;
}

export function useTasks(
  userId: string | undefined,
  { owner = true }: UseTasksOptions = {},
) {
  const tasks = useAppStore((state) => state.tasks);
  const loading = useAppStore((state) => state.tasksLoading);
  const [error, setError] = useState<string | null>(null);
  const setGlobalTasks = useAppStore((state) => state.setTasks);
  const setGlobalTasksLoading = useAppStore((state) => state.setTasksLoading);
  const setDataSyncError = useAppStore((state) => state.setDataSyncError);

  const commitTasks = useCallback(
    (nextTasks: Task[]) => {
      setGlobalTasks(nextTasks);
    },
    [setGlobalTasks],
  );

  const updateCommittedTasks = useCallback(
    (updater: (previousTasks: Task[]) => Task[]) => {
      setGlobalTasks(updater(useAppStore.getState().tasks));
    },
    [setGlobalTasks],
  );

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
    if (!owner || !userId) return;

    setGlobalTasksLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (fetchError) {
        setError("Failed to fetch tasks");
        setDataSyncError("tasks", "Failed to fetch tasks");
      } else {
        commitTasks(sortTasksByDueDate(data || []));
      }
    } catch (fetchError) {
      logger.error("Failed to fetch tasks", fetchError);
      setError("Failed to fetch tasks");
      setDataSyncError("tasks", "Failed to fetch tasks");
    } finally {
      setGlobalTasksLoading(false);
    }
  }, [
    commitTasks,
    owner,
    setDataSyncError,
    setGlobalTasksLoading,
    sortTasksByDueDate,
    userId,
  ]);

  const refreshTasks = useCallback(async () => {
    if (owner) {
      await fetchTasks();
      return;
    }

    if (userId) {
      useAppStore.getState().retryDataSync("tasks");
    }
  }, [fetchTasks, owner, userId]);

  useEffect(() => {
    if (!owner) return;

    if (!userId) {
      commitTasks([]);
      setGlobalTasksLoading(false);
      return;
    }

    void fetchTasks();

    // Retry signal: Dashboard may trigger a tasks retry without mounting this
    // hook, so listen to the store-level counter and refetch when it bumps.
    const retryUnsub = useAppStore.subscribe((state, prevState) => {
      if (
        state.dataSyncRetryCounters.tasks !==
        prevState.dataSyncRetryCounters.tasks
      ) {
        void fetchTasks();
      }
    });

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
            updateCommittedTasks((prev) => {
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
          } else           if (payload.eventType === "UPDATE") {
            const updated = payload.new as Task;
            updateCommittedTasks((prev) =>
              sortTasksByDueDate(
                prev.map((task) =>
                  task.id === updated.id ? updated : task,
                ),
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const oldId = payload.old["id"];
            updateCommittedTasks((prev) =>
              typeof oldId === "string"
                ? prev.filter((task) => task.id !== oldId)
                : prev,
            );
          }
        },
      )
      .subscribe((status) => {
        logger.log("Tasks subscription status:", status);
      });

    return () => {
      retryUnsub();
      subscription.unsubscribe();
    };
  }, [
    commitTasks,
    fetchTasks,
    owner,
    setGlobalTasksLoading,
    sortTasksByDueDate,
    updateCommittedTasks,
    userId,
  ]);

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
    type TaskInsertPayload = Pick<Task, "user_id" | "title" | "completed" | "priority"> &
      Partial<Pick<Task, "description" | "due_date" | "category" | "project_id">>;

    const cleanData: TaskInsertPayload = {
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

    // Optimistic update - add to the canonical task collection immediately
    updateCommittedTasks((prev) => sortTasksByDueDate([...(prev ?? []), data]));

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_TASK, "create_task")
      .then((result) => notifyGamificationResult(result))
      .catch((e) => logger.error("Failed to award XP", e));

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

    updateCommittedTasks((prev) =>
      sortTasksByDueDate(
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...sanitizedUpdates,
                updated_at: new Date().toISOString(),
              }
            : task,
        ),
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
      void refreshTasks();
      return false;
    }

    return true;
  }

  async function completeTask(taskId: string): Promise<boolean> {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    // Toggle completion status
    const newCompletedStatus = !task.completed;

    // Optimistic update
    updateCommittedTasks((prev) =>
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
      void refreshTasks();
      return false;
    }

    if (newCompletedStatus) {
      toast.success("Task completed! 🎉");
    }

    // Award XP only when completing (not un-completing, don't await to avoid blocking)
    // "Task completed! 🎉" doesn't announce XP, so full notify is fine
    if (newCompletedStatus && userId) {
      awardXP(userId, XP_REWARDS.COMPLETE_TASK, "complete_task")
        .then((result) => notifyGamificationResult(result))
        .catch((e) => logger.error("Failed to award XP", e));
    }

    return true;
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    // Optimistic delete
    const deletedTask = tasks.find((t) => t.id === taskId);
    updateCommittedTasks((prev) => prev.filter((task) => task.id !== taskId));

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
        updateCommittedTasks((prev) =>
          sortTasksByDueDate([...prev, deletedTask]),
        );
      }
      return false;
    }

    return true;
  }

  async function restoreTask(task: Task): Promise<Task | null> {
    if (!userId) return null;

    // Optimistic restore
    updateCommittedTasks((prev) => sortTasksByDueDate([...(prev ?? []), task]));

    const payload = {
      ...task,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error: restoreError } = await supabase
      .from("tasks")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (restoreError) {
      logger.error("Failed to restore task", restoreError);
      setError("Failed to restore task. Please try again.");
      toast.error("Failed to restore task");

      // Revert optimistic update
      updateCommittedTasks((prev) => prev.filter((t) => t.id !== task.id));
      return null;
    }

    toast.success("Task restored");
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
    restoreTask,
    refreshTasks,
  };
}
