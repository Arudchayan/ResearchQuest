import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseDateInput, todayKey } from "../utils/time";
import type { Task } from "../types/database";
import { completeOnboardingTip } from "./onboardingTipsStore";

export interface TodayPlanState {
  dayKey: string;
  orderedIds: string[];
  pendingFocusTaskId: string | null;
  ensureDay: () => void;
  pin: (id: string) => void;
  unpin: (id: string) => void;
  move: (id: string, direction: -1 | 1) => void;
  setPendingFocusTaskId: (id: string | null) => void;
  consumePendingFocusTaskId: () => string | null;
}

function rollDay(state: Pick<TodayPlanState, "dayKey" | "orderedIds">): {
  dayKey: string;
  orderedIds: string[];
} {
  const key = todayKey();
  if (state.dayKey === key) {
    return { dayKey: state.dayKey, orderedIds: state.orderedIds };
  }
  return { dayKey: key, orderedIds: [] };
}

export const useTodayPlanStore = create<TodayPlanState>()(
  persist(
    (set, get) => ({
      dayKey: todayKey(),
      orderedIds: [],
      pendingFocusTaskId: null,
      ensureDay: () => {
        const next = rollDay(get());
        if (next.dayKey !== get().dayKey) {
          set(next);
        }
      },
      pin: (id) => {
        const rolled = rollDay(get());
        if (rolled.orderedIds.includes(id)) {
          set(rolled);
          return;
        }
        set({ ...rolled, orderedIds: [...rolled.orderedIds, id] });
        completeOnboardingTip("plan-today");
      },
      unpin: (id) => {
        const rolled = rollDay(get());
        set({
          ...rolled,
          orderedIds: rolled.orderedIds.filter((itemId) => itemId !== id),
        });
      },
      move: (id, direction) => {
        const rolled = rollDay(get());
        const index = rolled.orderedIds.indexOf(id);
        if (index < 0) return;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= rolled.orderedIds.length) return;
        const orderedIds = [...rolled.orderedIds];
        const [removed] = orderedIds.splice(index, 1);
        if (!removed) return;
        orderedIds.splice(nextIndex, 0, removed);
        set({ ...rolled, orderedIds });
      },
      setPendingFocusTaskId: (pendingFocusTaskId) => set({ pendingFocusTaskId }),
      consumePendingFocusTaskId: () => {
        const id = get().pendingFocusTaskId;
        if (id) set({ pendingFocusTaskId: null });
        return id;
      },
    }),
    {
      name: "researchquest-today-plan",
      partialize: (state) => ({
        dayKey: state.dayKey,
        orderedIds: state.orderedIds,
      }),
    },
  ),
);

export function isLocalDueToday(dueDate: string | undefined): boolean {
  const parsed = parseDateInput(dueDate);
  if (!parsed) return false;
  return todayKey(parsed) === todayKey();
}

/** Incomplete tasks due today, plus pinned ids, in the user's Today order. */
export function resolveTodayTasks(tasks: Task[]): Task[] {
  const store = useTodayPlanStore.getState();
  store.ensureDay();
  const { orderedIds } = useTodayPlanStore.getState();
  const incomplete = tasks.filter((task) => !task.completed);
  const byId = new Map(incomplete.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const result: Task[] = [];

  for (const id of orderedIds) {
    const task = byId.get(id);
    if (!task) continue;
    result.push(task);
    seen.add(id);
  }

  for (const task of incomplete) {
    if (seen.has(task.id)) continue;
    if (isLocalDueToday(task.due_date)) {
      result.push(task);
    }
  }

  return result;
}
