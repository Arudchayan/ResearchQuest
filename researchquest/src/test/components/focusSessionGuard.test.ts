import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bumpFocusRunEpoch,
  currentFocusHydrateEpoch,
  currentFocusRunEpoch,
  ensureFocusSessionGuardAttached,
  registerFocusFreeze,
  subscribeFocusHydrateEpoch,
} from "../../components/focus/focusSessionGuard";

describe("focusSessionGuard", () => {
  beforeEach(() => {
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
});
