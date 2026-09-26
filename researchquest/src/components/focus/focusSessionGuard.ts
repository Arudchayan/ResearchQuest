/**
 * Eager Focus remount + freeze.
 *
 * Real browser hard refresh is a new document. The dying page's pagehide
 * remount never paints — Continue must come from cold hydrate of a paused
 * `rq_focus_session`. Playwright `page.reload()` Soft PASS was live-heap
 * pagehide, not that path.
 *
 * Capture-phase pagehide/pageshow/pageswap still freeze a surviving heap and
 * bump a hydrate epoch so App remounts FocusWorkspace via useSyncExternalStore.
 * Visibility hide only freezes the live interval (does not remount).
 */

import { useSyncExternalStore } from "react";
import {
  persistPausedFocusSession,
  rewriteStoredFocusSessionPaused,
  type SelectedTarget,
} from "./focusUtils";

export type FocusFreezeRegistration = {
  freeze: () => void;
  isLive: () => boolean;
};

export type LiveFocusPublish = {
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  timeLeft: number;
  hasCompletedSession: boolean;
  sessionCount: number;
  isLive: boolean;
  resumeHold: boolean;
};

let attached = false;
let registration: FocusFreezeRegistration | null = null;
let published: LiveFocusPublish | null = null;
let runEpoch = 0;
let hydrateEpoch = 0;
const hydrateListeners = new Set<() => void>();

const listenerOpts: AddEventListenerOptions = { capture: true };

function notifyHydrateEpoch(): void {
  hydrateEpoch += 1;
  hydrateListeners.forEach((listener) => {
    listener();
  });
}

function persistPublishedOrStoredPaused(): void {
  const live = published;
  if (live && (live.isLive || live.resumeHold)) {
    persistPausedFocusSession({
      selectedTarget: live.selectedTarget,
      sessionLength: live.sessionLength,
      liveIsRunning: false,
      liveStartedAt: null,
      timeLeft: live.timeLeft,
      hasCompletedSession: live.hasCompletedSession,
      sessionCount: live.sessionCount,
      keepAlive: true,
    });
    return;
  }
  rewriteStoredFocusSessionPaused();
}

function fireFreeze(): void {
  runEpoch += 1;
  registration?.freeze();
}

function fireHardRefreshRemount(): void {
  persistPublishedOrStoredPaused();
  fireFreeze();
  notifyHydrateEpoch();
}

function onPageShow(event: Event): void {
  const persisted = Boolean(
    "persisted" in event && (event as PageTransitionEvent).persisted,
  );
  if (!persisted && !registration?.isLive()) return;
  fireHardRefreshRemount();
}

function onVisibilityChange(): void {
  if (document.visibilityState !== "hidden" && !document.hidden) return;
  fireFreeze();
}

function onNavigate(event: Event): void {
  const navType =
    "navigationType" in event
      ? String((event as { navigationType?: string }).navigationType)
      : "";
  if (navType !== "reload") return;
  fireHardRefreshRemount();
}

export function currentFocusRunEpoch(): number {
  return runEpoch;
}

export function bumpFocusRunEpoch(): number {
  runEpoch += 1;
  return runEpoch;
}

export function currentFocusHydrateEpoch(): number {
  return hydrateEpoch;
}

export function subscribeFocusHydrateEpoch(listener: () => void): () => void {
  hydrateListeners.add(listener);
  return () => {
    hydrateListeners.delete(listener);
  };
}

export function useFocusHydrateEpoch(): number {
  return useSyncExternalStore(
    subscribeFocusHydrateEpoch,
    currentFocusHydrateEpoch,
    currentFocusHydrateEpoch,
  );
}

export function publishLiveFocusSnapshot(next: LiveFocusPublish | null): void {
  published = next;
}

export function ensureFocusSessionGuardAttached(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("pagehide", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("beforeunload", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("unload", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("freeze", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("pageswap", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("pageshow", onPageShow, listenerOpts);
  document.addEventListener("freeze", fireHardRefreshRemount, listenerOpts);
  document.addEventListener(
    "visibilitychange",
    onVisibilityChange,
    listenerOpts,
  );
  const navigation = (
    window as Window & {
      navigation?: EventTarget;
    }
  ).navigation;
  if (navigation && typeof navigation.addEventListener === "function") {
    navigation.addEventListener("navigate", onNavigate);
  }
}

export function registerFocusFreeze(
  next: FocusFreezeRegistration,
): () => void {
  ensureFocusSessionGuardAttached();
  registration = next;
  return () => {
    if (registration === next) registration = null;
  };
}
