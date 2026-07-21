import { useEffect, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { awardXP, XP_REWARDS } from "../utils/gamification";
import { toast } from "sonner";
import { parseDateInput } from "../utils/time";
import { logger } from "../utils/logger";
import { useAppStore } from "../store/appStore";
import type { Task } from "../types/database";

export type { Task } from "../types/database";

function sortTasksByDueDate(taskList: Task[]) {
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
}

function applyTasksRealtimePayload(payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  // Supabase provides different payload shapes depending on event type.
  // Use `any` here to avoid TS2352 between insert/update/delete payload variants,
  // then cast to Task based on `eventType`.
  new: any;
  old: any;
}) {
  const setTasks = useAppStore.getState().setTasks;

  logger.log("Tasks realtime update:", payload);

  if (payload.eventType === "INSERT") {
    const nextTask = payload.new as Task;
    const previousTasks = useAppStore.getState().tasks;
    const exists = previousTasks.some((task) => task.id === nextTask.id);
    if (exists) {
      logger.log(
        "Task already exists (from optimistic update), skipping realtime insert",
      );
      return;
    }
    setTasks(sortTasksByDueDate([...previousTasks, nextTask]));
    return;
  }

  if (payload.eventType === "UPDATE") {
    const updatedTask = payload.new as Task;
    const previousTasks = useAppStore.getState().tasks;
    setTasks(
      sortTasksByDueDate(
        previousTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        ),
      ),
    );
    return;
  }

  if (payload.eventType === "DELETE") {
    const deletedTask = payload.old as Task;
    const previousTasks = useAppStore.getState().tasks;
    setTasks(previousTasks.filter((task) => task.id !== deletedTask.id));
  }
}

let tasksRealtimeChannel: RealtimeChannel | null = null;
let tasksRealtimeUserId: string | null = null;
let tasksRealtimeRefCount = 0;

function acquireTasksRealtimeSubscription(userId: string) {
  // If we're switching users, fully tear down the previous channel.
  if (
    tasksRealtimeChannel &&
    tasksRealtimeUserId &&
    tasksRealtimeUserId !== userId
  ) {
    void tasksRealtimeChannel.unsubscribe();
    tasksRealtimeChannel = null;
    tasksRealtimeUserId = null;
    tasksRealtimeRefCount = 0;
  }

  tasksRealtimeRefCount += 1;

  if (tasksRealtimeChannel && tasksRealtimeUserId === userId) {
    return;
  }

  if (tasksRealtimeChannel) {
    void tasksRealtimeChannel.unsubscribe();
    tasksRealtimeChannel = null;
    tasksRealtimeUserId = null;
  }

  tasksRealtimeUserId = userId;
  tasksRealtimeChannel = supabase
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
        // Supabase uses different payload variants depending on eventType.
        // Keep runtime behavior, but loosen typing to satisfy TS.
        applyTasksRealtimePayload(payload as any);
      },
    )
    .subscribe((status) => {
      logger.log("Tasks subscription status:", status);
    });
}

function releaseTasksRealtimeSubscription() {
  tasksRealtimeRefCount = Math.max(0, tasksRealtimeRefCount - 1);

  if (tasksRealtimeRefCount > 0) {
    return;
  }

  if (tasksRealtimeChannel) {
    void tasksRealtimeChannel.unsubscribe();
    tasksRealtimeChannel = null;
    tasksRealtimeUserId = null;
  }
}

export function useTasks(userId: string | undefined) {
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
      const previousTasks = useAppStore.getState().tasks;
      setGlobalTasks(updater(previousTasks));
    },
    [setGlobalTasks],
  );

  const fetchTasks = useCallback(async () => {
    if (!userId) return;

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
  }, [userId, commitTasks, setGlobalTasksLoading, setDataSyncError]);

  useEffect(() => {
    if (!userId) {
      commitTasks([]);
      setGlobalTasksLoading(false);
      return;
    }

    fetchTasks();
    acquireTasksRealtimeSubscription(userId);

    return () => {
      releaseTasksRealtimeSubscription();
    };
  }, [commitTasks, fetchTasks, setGlobalTasksLoading, userId]);

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
    updateCommittedTasks((prev) => sortTasksByDueDate([...(prev ?? []), data]));

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

    void fetchTasks();
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
    restoreTask,
    refreshTasks: fetchTasks,
  };
}
