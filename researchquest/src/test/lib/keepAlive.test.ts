import { describe, expect, it } from "vitest";
import {
  isKeepAliveView,
  isKeepAliveVisible,
  recordKeepAliveVisit,
  shouldMountKeepAlive,
} from "../../lib/keepAlive";

describe("keep-alive visit set", () => {
  it("records Notes and Focus once and ignores other views", () => {
    let visited = new Set<string>();
    visited = recordKeepAliveVisit(visited, "dashboard");
    expect(visited.size).toBe(0);
    expect(isKeepAliveView("dashboard")).toBe(false);

    visited = recordKeepAliveVisit(visited, "notes");
    visited = recordKeepAliveVisit(visited, "notes");
    visited = recordKeepAliveVisit(visited, "focus");
    expect([...visited]).toEqual(["notes", "focus"]);
    expect(recordKeepAliveVisit(visited, "dashboard")).toBe(visited);
  });

  it("mounts a pane after first visit even when another view is active", () => {
    const visited = recordKeepAliveVisit(new Set(), "notes");
    expect(shouldMountKeepAlive("notes", "tasks", visited)).toBe(true);
    expect(isKeepAliveVisible("notes", "tasks")).toBe(false);
    expect(isKeepAliveVisible("notes", "notes")).toBe(true);
    expect(shouldMountKeepAlive("focus", "tasks", visited)).toBe(false);
  });
});
