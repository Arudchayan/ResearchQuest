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
import { XP_REWARDS } from "../utils/gamification";
import { toast } from "sonner";
import { parseDateInput } from "../utils/time";
import { logger } from "../utils/logger";
import { useAppStore } from "../store/appStore";
import { useEntityCrud, awardXPAndNotify, type AppStoreState } from "./useEntityCrud";
import type { Task } from "../types/database";

export type { Task } from "../types/database";

export interface UseTasksOptions {
  owner?: boolean;
}

const selectTasks = (state: AppStoreState) => state.tasks;
const selectSetTasks = (state: AppStoreState) => state.setTasks;
const selectTasksLoading = (state: AppStoreState) => state.tasksLoading;
const selectSelectedTask = (state: AppStoreState) => state.selectedTask;
const selectSetSelectedTask = (state: AppStoreState) => state.setSelectedTask;

function sortTasksByDueDate(taskList: Task[]): Task[] {
  return [...taskList].sort((a, b) => {
    const aDue = parseDateInput(a.due_date)?.getTime() ?? null;
    const bDue = parseDateInput(b.due_date)?.getTime() ?? null;
    if (aDue === null && bDue === null) {
      return a.created_at > b.created_at ? 1 : -1;
    }
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    if (aDue === bDue) {
      return a.created_at > b.created_at ? 1 : -1;
    }
    return aDue - bDue;
  });
}

function normalizeDate(value: string): string {
  const normalized = parseDateInput(value);
  return normalized
    ? `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`
    : value;
}

const TASK_ERROR_MESSAGE: Record<string, string> = {
  create: "Failed to create task. Please try again.",
  update: "Failed to update task. Please try again.",
  delete: "Failed to delete task. Please try again.",
  restore: "Failed to restore task. Please try again.",
};

export function useTasks(
  userId: string | undefined,
  { owner = true }: UseTasksOptions = {},
) {
  const [fetchError, setFetchError] = useState<string | null>(null);
  const setGlobalTasks = useAppStore(selectSetTasks);
  const setGlobalTasksLoading = useAppStore((state) => state.setTasksLoading);
  const setDataSyncError = useAppStore((state) => state.setDataSyncError);

  const crud = useEntityCrud<Task, Partial<Task>>({
    userId,
    items: selectTasks,
    setItems: selectSetTasks,
    loading: selectTasksLoading,
    selected: selectSelectedTask,
    setSelected: selectSetSelectedTask,
    entityLabel: "Task",
    entityPlural: "tasks",
    createVerb: "create",
    tableName: "tasks",
    sort: sortTasksByDueDate,
    prepareCreate: (taskData, uid, fail) => {
      if (!taskData.title || !taskData.title.trim()) {
        fail("Task title is required");
        return null;
      }
      if (taskData.title.length > 255) {
        fail("Task title exceeds 255 characters");
        return null;
      }
      if (taskData.description && taskData.description.length > 1000) {
        fail("Task description exceeds 1000 characters");
        return null;
      }

      const cleanData: Partial<Task> = {
        user_id: uid,
        title: taskData.title.trim(),
        completed: false,
        priority: taskData.priority || "medium",
      };
      if (taskData.description && taskData.description.trim()) {
        cleanData.description = taskData.description.trim();
      }
      if (taskData.due_date && taskData.due_date.trim()) {
        cleanData.due_date = normalizeDate(taskData.due_date.trim());
      }
      if (taskData.category && taskData.category.trim()) {
        cleanData.category = taskData.category.trim();
      }
      if (taskData.project_id && taskData.project_id.trim()) {
        cleanData.project_id = taskData.project_id.trim();
      }
      return cleanData;
    },
    prepareUpdate: (_current, updates, fail) => {
      if (updates.title && updates.title.length > 255) {
        fail("Task title exceeds 255 characters");
        return null;
      }
      if (updates.description && updates.description.length > 1000) {
        fail("Task description exceeds 1000 characters");
        return null;
      }
      const sanitized: Partial<Task> = { ...updates };
      if (typeof sanitized.due_date === "string" && sanitized.due_date.trim()) {
        sanitized.due_date = normalizeDate(sanitized.due_date.trim());
      }
      return sanitized;
    },
    xpCreate: { reward: XP_REWARDS.CREATE_TASK, action: "create_task" },
    afterUpdateSuccess: (uid, payload, snapshot) => {
      // XP + celebration only when completing, not un-completing
      if (payload.completed && !snapshot?.completed) {
        toast.success("Task completed! 🎉");
        awardXPAndNotify(uid, XP_REWARDS.COMPLETE_TASK, "complete_task");
      }
    },
    onError: (op, _err, setError) => {
      const message = TASK_ERROR_MESSAGE[op];
      setError(message);
      toast.error(message);
    },
  });

  const updateCommittedTasks = useCallback(
    (updater: (previousTasks: Task[]) => Task[]) => {
      setGlobalTasks(updater(useAppStore.getState().tasks));
    },
    [setGlobalTasks],
  );

  const fetchTasks = useCallback(async () => {
    if (!owner || !userId) return;

    setGlobalTasksLoading(true);
    setFetchError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (fetchError) {
        setFetchError("Failed to fetch tasks");
        setDataSyncError("tasks", "Failed to fetch tasks");
      } else {
        setGlobalTasks(sortTasksByDueDate(data || []));
      }
    } catch (fetchError) {
      logger.error("Failed to fetch tasks", fetchError);
      setFetchError("Failed to fetch tasks");
      setDataSyncError("tasks", "Failed to fetch tasks");
    } finally {
      setGlobalTasksLoading(false);
    }
  }, [
    owner,
    setDataSyncError,
    setGlobalTasks,
    setGlobalTasksLoading,
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
      setGlobalTasks([]);
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
          if (payload.eventType === "INSERT") {
            // Skip if the task already exists (from an optimistic create)
            updateCommittedTasks((prev) => {
              const exists = prev.some(
                (t) => t.id === (payload.new as Task).id,
              );
              return exists
                ? prev
                : sortTasksByDueDate([...prev, payload.new as Task]);
            });
          } else if (payload.eventType === "UPDATE") {
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
      .subscribe();

    return () => {
      retryUnsub();
      subscription.unsubscribe();
    };
  }, [
    fetchTasks,
    owner,
    setGlobalTasks,
    setGlobalTasksLoading,
    updateCommittedTasks,
    userId,
  ]);

  const completeTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return false;
      return crud.update(taskId, { completed: !task.completed });
    },
    [crud],
  );

  return {
    tasks: crud.items,
    loading: crud.loading,
    error: crud.error ?? fetchError,
    createTask: crud.create,
    updateTask: crud.update,
    completeTask,
    deleteTask: crud.delete,
    restoreTask: crud.restore,
    refreshTasks,
  };
}
