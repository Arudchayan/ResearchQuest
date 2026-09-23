import { describe, expect, it } from "vitest";
import { dedupeById, preferNewerByUpdatedAt } from "../../utils/collections";

describe("dedupeById", () => {
  it("collapses duplicate ids, keeping the later copy in input order", () => {
    const created = { id: "task-1", title: "Created" };
    const echo = { id: "task-1", title: "Realtime echo" };
    const existing = { id: "task-0", title: "Older" };

    expect(dedupeById([created, echo, existing])).toEqual([echo, existing]);
  });
});

describe("preferNewerByUpdatedAt", () => {
  it("keeps the local row when it was updated after the incoming snapshot", () => {
    const incoming = [
      {
        id: "note-first-run",
        title: "",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const current = [
      {
        id: "note-first-run",
        title: "Demo research synthesis",
        updated_at: "2026-01-01T00:01:00.000Z",
      },
    ];

    expect(preferNewerByUpdatedAt(incoming, current)).toEqual(current);
  });

  it("does not resurrect rows missing from the incoming snapshot", () => {
    const incoming = [
      { id: "note-1", title: "Kept", updated_at: "2026-01-01T00:00:00.000Z" },
    ];
    const current = [
      { id: "note-1", title: "Kept", updated_at: "2026-01-01T00:00:00.000Z" },
      {
        id: "note-deleted",
        title: "Gone",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ];

    expect(preferNewerByUpdatedAt(incoming, current)).toEqual(incoming);
  });
});
