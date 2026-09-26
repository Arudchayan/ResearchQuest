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

  it("pagehide without freeze registration persists published live snapshot paused", () => {
    publishLiveFocusSnapshot({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      timeLeft: 24 * 60 + 55,
      hasCompletedSession: false,
      sessionCount: 1,
      isLive: true,
      resumeHold: false,
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

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(false);
    expect(stored.timeLeft).toBe(24 * 60 + 55);
    expect(stored.startedAt).toBeNull();
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
});
