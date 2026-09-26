/**
 * Eager Focus remount + freeze.
 *
 * Hard refresh must land Continue from cold hydrate of `rq_focus_session`,
 * not from setState on a surviving live heap. Capture-phase pagehide/pageshow
 * bump a hydrate epoch so App remounts FocusWorkspace; that instance loads
 * storage paused. Freeze still disarms any interval on the outgoing instance.
 *
 * Visibility hide only freezes the live heap (does not remount). That is not
 * sufficient for QA/wine hard refresh.
 */

export type FocusFreezeRegistration = {
  freeze: () => void;
  isLive: () => boolean;
};

let attached = false;
let registration: FocusFreezeRegistration | null = null;
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

function fireFreeze(): void {
  runEpoch += 1;
  registration?.freeze();
}

function fireHardRefreshRemount(): void {
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

export function ensureFocusSessionGuardAttached(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("pagehide", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("beforeunload", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("unload", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("freeze", fireHardRefreshRemount, listenerOpts);
  window.addEventListener("pageshow", onPageShow, listenerOpts);
  document.addEventListener(
    "visibilitychange",
    onVisibilityChange,
    listenerOpts,
  );
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
