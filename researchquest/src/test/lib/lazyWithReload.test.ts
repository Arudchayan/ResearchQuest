import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  __setReloadPageForTests,
  guardImport,
  isChunkLoadFailure,
  lazyWithReload,
} from "@/lib/lazyWithReload";

const CHUNK_ERROR = new Error(
  "Failed to fetch dynamically imported module: https://rq.arudchayan.com/assets/TaskManager-C056Ip53.js",
);
const FLAG = "rq_chunk_reload_attempted";

describe("isChunkLoadFailure", () => {
  it("detects the stale-chunk import error from the outage", () => {
    expect(isChunkLoadFailure(CHUNK_ERROR)).toBe(true);
  });

  it("detects other bundler chunk failures", () => {
    expect(isChunkLoadFailure(new Error("Loading chunk 42 failed"))).toBe(
      true,
    );
    expect(
      isChunkLoadFailure(new Error("Importing a module script failed.")),
    ).toBe(true);
    expect(
      isChunkLoadFailure(
        new Error(
          "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of text/html.",
        ),
      ),
    ).toBe(true);
  });

  it("does not match app-logic or API errors", () => {
    expect(isChunkLoadFailure(new Error("Task was not saved"))).toBe(false);
    // A plain API fetch failure is a network issue, not a stale chunk.
    expect(isChunkLoadFailure(new TypeError("Failed to fetch"))).toBe(false);
    expect(isChunkLoadFailure(new Error("NetworkError"))).toBe(false);
  });
});

describe("guardImport", () => {
  let reload: ReturnType<typeof vi.fn>;
  let restoreReload: () => void;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    restoreReload = __setReloadPageForTests(reload);
  });

  afterEach(() => {
    restoreReload();
    sessionStorage.clear();
  });

  it("resolves successful imports untouched", async () => {
    const mod = { default: () => null };
    await expect(
      guardImport(() => Promise.resolve(mod)),
    ).resolves.toBe(mod);
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(FLAG)).toBeNull();
  });

  it("reloads once on the first chunk failure and never settles", async () => {
    let settled = false;
    const pending = guardImport(() => Promise.reject(CHUNK_ERROR)).then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    // Flush the rejection through the guard.
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(FLAG)).toBe("1");
    expect(settled).toBe(false);
    void pending;
  });

  it("rethrows the second chunk failure instead of reload-looping", async () => {
    sessionStorage.setItem(FLAG, "1");
    await expect(guardImport(() => Promise.reject(CHUNK_ERROR))).rejects.toBe(
      CHUNK_ERROR,
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it("rethrows non-chunk errors immediately", async () => {
    const appError = new Error("Task was not saved");
    await expect(guardImport(() => Promise.reject(appError))).rejects.toBe(
      appError,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(FLAG)).toBeNull();
  });

  it("rethrows chunk failures while offline instead of reloading", async () => {    const descriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "onLine",
    );
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });
    try {
      await expect(
        guardImport(() => Promise.reject(CHUNK_ERROR)),
      ).rejects.toBe(CHUNK_ERROR);
      expect(reload).not.toHaveBeenCalled();
    } finally {
      if (descriptor) {
        Object.defineProperty(window.navigator, "onLine", descriptor);
      }
    }
  });

  it("rethrows when storage is unavailable instead of risking a loop", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    try {
      await expect(
        guardImport(() => Promise.reject(CHUNK_ERROR)),
      ).rejects.toBe(CHUNK_ERROR);
      expect(reload).not.toHaveBeenCalled();
    } finally {
      getItem.mockRestore();
    }
  });
});

describe("lazyWithReload", () => {
  it("returns a lazy component that renders the module", () => {
    const Comp = lazyWithReload(() =>
      Promise.resolve({ default: () => null }),
    );
    expect(Comp).toBeDefined();
    // React.lazy components carry the internal $$typeof marker.
    expect((Comp as unknown as { $$typeof: symbol }).$$typeof).toBeDefined();
  });
});
