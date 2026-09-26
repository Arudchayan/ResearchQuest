import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bumpFocusRunEpoch,
  currentFocusHydrateEpoch,
  currentFocusRunEpoch,
  ensureFocusSessionGuardAttached,
  publishLiveFocusSnapshot,
  registerFocusFreeze,
  subscribeFocusHydrateEpoch,
} from "../../components/focus/focusSessionGuard";
import {
  FOCUS_SESSION_STORAGE_KEY,
  saveFocusSession,
} from "../../components/focus/focusUtils";

describe("focusSessionGuard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    publishLiveFocusSnapshot(null);
    if (!(window as Window & { navigation?: EventTarget }).navigation) {
      Object.defineProperty(window, "navigation", {
        configurable: true,
        value: new EventTarget(),
      });
    }
    ensureFocusSessionGuardAttached();
  });

  it("capture-phase pagehide freezes a live run without visibility hidden", () => {
    const freeze = vi.fn();
    const unregister = registerFocusFreeze({
      freeze,
      isLive: () => true,
    });

    window.dispatchEvent(new Event("pagehide"));
    expect(freeze).toHaveBeenCalledTimes(1);

    unregister();
  });

  it("pageshow(persisted=false) of a live heap freezes; idle Start-only heap does not", () => {
    const freeze = vi.fn();
    let live = false;
    const unregister = registerFocusFreeze({
      freeze,
      isLive: () => live,
    });

    const idleShow = new Event("pageshow");
    Object.defineProperty(idleShow, "persisted", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(idleShow);
    expect(freeze).not.toHaveBeenCalled();

    live = true;
    const liveShow = new Event("pageshow");
    Object.defineProperty(liveShow, "persisted", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(liveShow);
    expect(freeze).toHaveBeenCalledTimes(1);

    unregister();
  });

  it("pagehide of a Start-only registration still freezes (idempotent), bumping epoch", () => {
    const freeze = vi.fn();
    const before = currentFocusRunEpoch();
    const unregister = registerFocusFreeze({
      freeze,
      isLive: () => false,
    });

    window.dispatchEvent(new Event("pagehide"));
    expect(freeze).toHaveBeenCalledTimes(1);
    expect(currentFocusRunEpoch()).toBeGreaterThan(before);

    unregister();
  });

  it("pagehide bumps hydrate epoch so App can remount from storage", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFocusHydrateEpoch(listener);
    const before = currentFocusHydrateEpoch();
    const unregister = registerFocusFreeze({
      freeze: vi.fn(),
      isLive: () => true,
    });

    window.dispatchEvent(new Event("pagehide"));
    expect(currentFocusHydrateEpoch()).toBeGreaterThan(before);
    expect(listener).toHaveBeenCalled();

    unregister();
    unsubscribe();
  });

  it("visibility hide does not bump hydrate epoch", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFocusHydrateEpoch(listener);
    const before = currentFocusHydrateEpoch();
    const unregister = registerFocusFreeze({
      freeze: vi.fn(),
      isLive: () => true,
    });

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(currentFocusHydrateEpoch()).toBe(before);
    expect(listener).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    unregister();
    unsubscribe();
  });

  it("pagehide without freeze registration persists published live snapshot live", () => {
    const startedAt = Date.now();
    const deadline = startedAt + 25 * 60 * 1000;
    publishLiveFocusSnapshot({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      timeLeft: 24 * 60 + 55,
      hasCompletedSession: false,
      sessionCount: 1,
      isLive: true,
      resumeHold: false,
      deadlineMs: deadline,
      startedAtMs: startedAt,
    });
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now(),
      timeLeft: 24 * 60 + 58,
      hasCompletedSession: false,
      sessionCount: 1,
    });

    window.dispatchEvent(new Event("pagehide"));

    // Deadline-derived countdown: the flushed snapshot keeps the live run
    // (deadline intact) so a remount resumes instead of freezing.
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.timeLeft).toBe(24 * 60 + 55);
    expect(stored.startedAt).toBe(startedAt);
    expect(stored.deadline).toBe(deadline);
  });

  it("pagehide with no live snapshot and empty storage stays Start-only empty", () => {
    window.dispatchEvent(new Event("pagehide"));
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("pageswap of a live run freezes even without visibility hidden", () => {
    const freeze = vi.fn();
    const unregister = registerFocusFreeze({
      freeze,
      isLive: () => true,
    });

    window.dispatchEvent(new Event("pageswap"));
    expect(freeze).toHaveBeenCalledTimes(1);

    unregister();
  });

  it("pageshow(false) of a stored running snapshot remounts even when Focus has not registered yet", () => {
    // Wine new-document: pageshow fires while App is still the loading
    // skeleton (lazy Focus not mounted, registration null). #804 returned
    // early unless isLive() — Playwright reload Soft PASS had a live heap.
    const listener = vi.fn();
    const unsubscribe = subscribeFocusHydrateEpoch(listener);
    const before = currentFocusHydrateEpoch();
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now() - 12 * 1000,
      timeLeft: 24 * 60 + 48,
      hasCompletedSession: false,
      sessionCount: 1,
    });

    const show = new Event("pageshow");
    Object.defineProperty(show, "persisted", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(show);

    expect(currentFocusHydrateEpoch()).toBeGreaterThan(before);
    expect(listener).toHaveBeenCalled();
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(false);
    expect(stored.timeLeft).toBe(24 * 60 + 48);

    unsubscribe();
  });

  it("same-document replace of the current URL persists the live run (wine Product refresh)", () => {
    // Playwright page.reload() is navigationType=reload (preview Soft PASS).
    // Wine Product hard refresh is often location.replace(href) — type=replace —
    // no new document, no pagehide remount paint. The flushed snapshot keeps
    // the live run (deadline intact) so the timer survives the navigation.
    const freeze = vi.fn();
    const unregister = registerFocusFreeze({
      freeze,
      isLive: () => true,
    });
    const startedAt = Date.now();
    const deadline = startedAt + 25 * 60 * 1000;
    publishLiveFocusSnapshot({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      timeLeft: 24 * 60 + 48,
      hasCompletedSession: false,
      sessionCount: 1,
      isLive: true,
      resumeHold: false,
      deadlineMs: deadline,
      startedAtMs: startedAt,
    });

    const event = new Event("navigate");
    Object.defineProperty(event, "navigationType", {
      configurable: true,
      value: "replace",
    });
    Object.defineProperty(event, "destination", {
      configurable: true,
      value: { url: window.location.href },
    });
    const navigation = (
      window as Window & { navigation?: EventTarget }
    ).navigation;
    expect(navigation).toBeDefined();
    navigation!.dispatchEvent(event);

    expect(freeze).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.timeLeft).toBe(24 * 60 + 48);
    expect(stored.deadline).toBe(deadline);
    expect(stored.startedAt).toBe(startedAt);

    unregister();
  });
});
