import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  REDIRECT_PATH_STORAGE_KEY,
  restoreRedirectPath,
} from "../../lib/router";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("restoreRedirectPath", () => {
  it("replaces the URL with the stashed deep link and clears storage", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("/notes/note-1"),
      removeItem: vi.fn(),
    };
    const loc = { pathname: "/", search: "", hash: "" };
    const historyApi = { replaceState: vi.fn() };

    expect(restoreRedirectPath(storage, loc, historyApi)).toBe("/notes/note-1");
    expect(storage.removeItem).toHaveBeenCalledWith(REDIRECT_PATH_STORAGE_KEY);
    expect(historyApi.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/notes/note-1",
    );
  });

  it("rejects open-redirect style values", () => {
    const historyApi = { replaceState: vi.fn() };
    for (const raw of ["//evil.test", "https://evil.test/x", "notes"]) {
      const storage = {
        getItem: vi.fn().mockReturnValue(raw),
        removeItem: vi.fn(),
      };
      expect(
        restoreRedirectPath(
          storage,
          { pathname: "/", search: "", hash: "" },
          historyApi,
        ),
      ).toBeNull();
      expect(historyApi.replaceState).not.toHaveBeenCalled();
    }
  });

  it("is a no-op when nothing was stashed", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
    };
    const historyApi = { replaceState: vi.fn() };
    expect(
      restoreRedirectPath(
        storage,
        { pathname: "/", search: "", hash: "" },
        historyApi,
      ),
    ).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(historyApi.replaceState).not.toHaveBeenCalled();
  });
});

describe("SPA deploy config", () => {
  it("keeps Vercel SPA rewrites at the project root (not public/)", () => {
    const vercel = JSON.parse(
      readFileSync(path.join(projectRoot, "vercel.json"), "utf8"),
    ) as { rewrites?: Array<{ source: string; destination: string }> };

    expect(vercel.rewrites).toEqual([
      { source: "/(.*)", destination: "/index.html" },
    ]);

    expect(() =>
      readFileSync(path.join(projectRoot, "public/vercel.json"), "utf8"),
    ).toThrow();
  });

  it("pairs 404.html redirectPath stash with the restore helper key", () => {
    const html = readFileSync(
      path.join(projectRoot, "public/404.html"),
      "utf8",
    );
    expect(html).toContain(`sessionStorage.setItem('${REDIRECT_PATH_STORAGE_KEY}'`);
    expect(html).toContain("window.location.replace('/')");
  });
});
