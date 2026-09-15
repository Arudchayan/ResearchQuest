/**
 * App store facade (PR13, item 31).
 *
 * The god store was split into four domain stores — `useShellStore`
 * (shellStore.ts), `useLibraryStore` (libraryStore.ts), `useTopicsStore`
 * (topicsStore.ts), `useTasksStore` (tasksStore.ts) — so views subscribe
 * only to the domain they render.
 *
 * This module keeps `useAppStore` working exactly as before (hook with
 * selector/equality, `getState`, `setState`, `subscribe`) by merging the
 * four domain states into one snapshot. All existing imports keep working;
 * prefer the domain hooks in new code and in the hot paths (Dashboard).
 */
import { useSyncExternalStore } from "react";
import {
  useShellStore,
  type ShellSlice,
  type DataSyncError,
  type DataSyncResource,
} from "./shellStore";
import { useLibraryStore, type LibrarySlice } from "./libraryStore";
import { useTopicsStore, type TopicsSlice } from "./topicsStore";
import { useTasksStore, type TasksSlice } from "./tasksStore";
import type { TopicWithCounts } from "../types/database";
import type { AppView } from "../lib/router";

export type { AppView };
export type { DataSyncError, DataSyncResource };
export type { DashboardLibrarySnapshot } from "./libraryStore";
export { useShellStore } from "./shellStore";
export { useLibraryStore } from "./libraryStore";
export { useTopicsStore } from "./topicsStore";
export { useTasksStore } from "./tasksStore";

export type AppState = ShellSlice & LibrarySlice & TopicsSlice & TasksSlice;

/**
 * Back-compat `setState` input: the `topics` key historically accepted a
 * `Record<string, TopicWithCounts>` (pre-item-32 shape). The facade still
 * accepts it and normalizes to the canonical array, so older call sites and
 * tests (`setState({ topics: {} })`) keep compiling and working.
 */
export type TopicsStateInput =
  | TopicWithCounts[]
  | Record<string, TopicWithCounts>;

export type AppStateInput = Omit<AppState, "topics"> & {
  topics?: TopicsStateInput;
};

export type AppSetStateAction =
  | Partial<AppStateInput>
  | ((state: AppState) => Partial<AppStateInput>);

type FacadeListener = (state: AppState, prevState: AppState) => void;

const domainStores = [
  useShellStore,
  useLibraryStore,
  useTopicsStore,
  useTasksStore,
] as const;

function normalizeTopicsInput(value: TopicsStateInput): TopicWithCounts[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.values(value) as TopicWithCounts[];
  }
  return [];
}

function readMergedState(): AppState {
  return {
    ...useShellStore.getState(),
    ...useLibraryStore.getState(),
    ...useTopicsStore.getState(),
    ...useTasksStore.getState(),
  };
}

let mergedState: AppState = readMergedState();
/** True while a facade `setState` fan-out is applying (suppresses per-store notifies; one notify follows). */
let isApplyingFanOut = false;
const facadeListeners = new Set<FacadeListener>();

function refreshMergedState(notify: boolean): void {
  const prevState = mergedState;
  mergedState = readMergedState();
  if (notify) {
    facadeListeners.forEach((listener) => listener(mergedState, prevState));
  }
}

domainStores.forEach((store) => {
  store.subscribe(() => {
    // During a facade fan-out the merged snapshot is refreshed silently and
    // notified once afterwards, so multi-domain partials still produce a
    // single facade notification (same as the old single store).
    refreshMergedState(!isApplyingFanOut);
  });
});

function findOwner(
  key: string,
): ((partial: Record<string, unknown>) => void) | undefined {
  const owner = domainStores.find((store) => key in store.getState());
  if (!owner) return undefined;
  return owner.setState as (partial: Record<string, unknown>) => void;
}

function applySetState(action: AppSetStateAction): void {
  const partial =
    typeof action === "function"
      ? (action as (state: AppState) => Partial<AppStateInput>)(mergedState)
      : action;
  if (!partial || typeof partial !== "object") return;

  const { topics, ...rest } = partial;
  isApplyingFanOut = true;
  try {
    for (const [key, value] of Object.entries(rest)) {
      findOwner(key)?.({ [key]: value });
    }
    if (topics !== undefined) {
      useTopicsStore.setState({ topics: normalizeTopicsInput(topics) });
    }
  } finally {
    isApplyingFanOut = false;
  }
  refreshMergedState(true);
}

const facadeApi = {
  getState: (): AppState => mergedState,
  setState: (partial: AppSetStateAction): void => {
    applySetState(partial);
  },
  subscribe: (listener: FacadeListener): (() => void) => {
    facadeListeners.add(listener);
    return () => {
      facadeListeners.delete(listener);
    };
  },
  destroy: (): void => {
    facadeListeners.clear();
  },
};

/**
 * Compatible facade hook: `useAppStore(selector?)`.
 * Matches the old plain-`create` bound store semantics exactly: Object.is
 * comparison on the selected slice (callers needing shallow-object
 * comparison keep wrapping their selector in `useShallow(...)`, as before).
 * Implemented directly on `useSyncExternalStore` so the facade needs no
 * extra dependencies (`zustand/traditional` would pull in
 * `use-sync-external-store`, which is not installed).
 */
export function useAppStore<Slice>(
  selector: (state: AppState) => Slice = (state) =>
    state as unknown as Slice,
): Slice {
  return useSyncExternalStore(
    facadeApi.subscribe,
    () => selector(facadeApi.getState()),
    () => selector(facadeApi.getState()),
  );
}

useAppStore.getState = facadeApi.getState;
useAppStore.setState = facadeApi.setState;
useAppStore.subscribe = facadeApi.subscribe;
useAppStore.destroy = facadeApi.destroy;
