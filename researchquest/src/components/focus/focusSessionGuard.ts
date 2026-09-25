/**
 * Eager page-lifecycle freeze for Focus.
 *
 * FocusWorkspace is lazy-loaded. React layout/bubble listeners on that chunk
 * do not run on wine/QA hard refresh (document may hide without visibilitychange,
 * and unload can skip bubble-phase pagehide). This module attaches capture-phase
 * listeners once — imported from main.tsx so they exist before the lazy view.
 *
 * Cold hydrate from rq_focus_session must still land Continue without these
 * events. The guard only disarms a live heap that never unmounted.
 */

export type FocusFreezeRegistration = {
  freeze: () => void;
  isLive: () => boolean;
};

let attached = false;
let registration: FocusFreezeRegistration | null = null;
let runEpoch = 0;

const listenerOpts: AddEventListenerOptions = { capture: true };

function fireFreeze(): void {
  runEpoch += 1;
  registration?.freeze();
}

function onPageShow(event: Event): void {
  const persisted = Boolean(
    "persisted" in event && (event as PageTransitionEvent).persisted,
  );
  if (!persisted && !registration?.isLive()) return;
  fireFreeze();
}

function onVisibilityChange(): void {
  if (document.visibilityState !== "hidden" && !document.hidden) return;
  fireFreeze();
}

export function currentFocusRunEpoch(): number {
  return runEpoch;
}

export function bumpFocusRunEpoch(): number {
  runEpoch += 1;
  return runEpoch;
}

export function ensureFocusSessionGuardAttached(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("pagehide", fireFreeze, listenerOpts);
  window.addEventListener("beforeunload", fireFreeze, listenerOpts);
  window.addEventListener("unload", fireFreeze, listenerOpts);
  window.addEventListener("freeze", fireFreeze, listenerOpts);
  window.addEventListener("pageshow", onPageShow, listenerOpts);
  document.addEventListener("visibilitychange", onVisibilityChange, listenerOpts);
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
