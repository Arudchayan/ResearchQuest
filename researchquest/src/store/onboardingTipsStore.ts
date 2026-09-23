import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppView } from "../lib/router";

export type ContextualTipId =
  | "plan-today"
  | "capture-note"
  | "add-paper"
  | "capture-idea"
  | "add-task";

export interface ContextualTip {
  id: ContextualTipId;
  view: AppView;
  title: string;
  description: string;
}

export const CONTEXTUAL_TIPS: readonly ContextualTip[] = [
  {
    id: "plan-today",
    view: "dashboard",
    title: "Plan Today",
    description: "Pin one task you will actually do.",
  },
  {
    id: "capture-note",
    view: "notes",
    title: "Capture a note",
    description: "Write one finding while it is fresh.",
  },
  {
    id: "add-paper",
    view: "papers",
    title: "Add a paper",
    description: "Save a paper to this workspace.",
  },
  {
    id: "capture-idea",
    view: "ideas",
    title: "Capture an idea",
    description: "Park a spark on the board.",
  },
  {
    id: "add-task",
    view: "tasks",
    title: "Add a task",
    description: "Turn reading or writing into a task.",
  },
];

const CREATE_TABLE_TIP_IDS: Record<string, ContextualTipId> = {
  notes: "capture-note",
  papers: "add-paper",
  ideas: "capture-idea",
  tasks: "add-task",
};

interface OnboardingTipsState {
  doneIds: ContextualTipId[];
  complete: (id: ContextualTipId) => void;
}

export const useOnboardingTipsStore = create<OnboardingTipsState>()(
  persist(
    (set, get) => ({
      doneIds: [],
      complete: (id) => {
        if (get().doneIds.includes(id)) return;
        set({ doneIds: [...get().doneIds, id] });
      },
    }),
    {
      name: "researchquest-onboarding-tips",
      partialize: (state) => ({ doneIds: state.doneIds }),
    },
  ),
);

export function completeOnboardingTip(id: ContextualTipId): void {
  useOnboardingTipsStore.getState().complete(id);
}

export function completeOnboardingCreate(tableName: string): void {
  const id = CREATE_TABLE_TIP_IDS[tableName];
  if (!id) return;
  completeOnboardingTip(id);
}

export function tipForView(view: AppView): ContextualTip | null {
  const tip = CONTEXTUAL_TIPS.find((item) => item.view === view);
  if (!tip) return null;
  if (useOnboardingTipsStore.getState().doneIds.includes(tip.id)) {
    return null;
  }
  return tip;
}
