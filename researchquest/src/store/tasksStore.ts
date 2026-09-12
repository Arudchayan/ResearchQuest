import { create } from "zustand";
import type { Task } from "../types/database";

/**
 * Tasks slice: the tasks collection (global cache), its selection and
 * loading flag. Sole writer is useTasks (realtime owner).
 */
export interface TasksSlice {
  tasks: Task[];
  tasksLoading: boolean;
  selectedTask: Task | null;
  setTasks: (tasks: Task[]) => void;
  setTasksLoading: (loading: boolean) => void;
  setSelectedTask: (task: Task | null) => void;
}

export const useTasksStore = create<TasksSlice>()((set) => ({
  tasks: [],
  tasksLoading: false,
  selectedTask: null,
  setTasks: (tasks) => set({ tasks }),
  setTasksLoading: (tasksLoading) => set({ tasksLoading }),
  setSelectedTask: (selectedTask) => set({ selectedTask }),
}));
