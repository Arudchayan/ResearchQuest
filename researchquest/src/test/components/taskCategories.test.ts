import { describe, it, expect } from "vitest";
import { CATEGORIES } from "../../components/tasks/taskTypes";

describe("task categories", () => {
  it("includes mixed-work kinds for the day loop", () => {
    expect(CATEGORIES).toEqual(
      expect.arrayContaining(["Study", "Personal", "Exercise", "Offline", "Research"]),
    );
  });
});
