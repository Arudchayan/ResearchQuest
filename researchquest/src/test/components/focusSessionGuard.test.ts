import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bumpFocusRunEpoch,
  currentFocusRunEpoch,
  ensureFocusSessionGuardAttached,
  registerFocusFreeze,
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

  it("bumpFocusRunEpoch invalidates a captured interval epoch", () => {
    const epoch = bumpFocusRunEpoch();
    expect(currentFocusRunEpoch()).toBe(epoch);
    bumpFocusRunEpoch();
    expect(currentFocusRunEpoch()).not.toBe(epoch);
  });
});
