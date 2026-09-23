import { describe, expect, it } from "vitest";
import { dedupeById } from "../../utils/collections";

describe("dedupeById", () => {
  it("collapses duplicate ids, keeping the later copy in input order", () => {
    const created = { id: "task-1", title: "Created" };
    const echo = { id: "task-1", title: "Realtime echo" };
    const existing = { id: "task-0", title: "Older" };

    expect(dedupeById([created, echo, existing])).toEqual([echo, existing]);
  });
});
