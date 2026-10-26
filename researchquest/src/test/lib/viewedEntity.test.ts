import { describe, expect, it } from "vitest";
import { resolveViewedEntity } from "../../lib/viewedEntity";

describe("resolveViewedEntity", () => {
  const weekly = { id: "note-0006" };
  const weird = { id: "paper-0002" };
  const seed = { id: "idea-0001" };

  it("uses the selected paper on papers view even if a note is still selected", () => {
    expect(
      resolveViewedEntity("papers", {
        note: weekly,
        paper: weird,
        idea: seed,
      }),
    ).toEqual({ id: "paper-0002", type: "paper" });
  });

  it("uses the selected note on notes view even if a paper is still selected", () => {
    expect(
      resolveViewedEntity("notes", {
        note: weekly,
        paper: weird,
        idea: null,
      }),
    ).toEqual({ id: "note-0006", type: "note" });
  });

  it("does not fall back to a leftover note when papers view has no paper selected", () => {
    expect(
      resolveViewedEntity("papers", {
        note: weekly,
        paper: null,
        idea: null,
      }),
    ).toBeNull();
  });
});
