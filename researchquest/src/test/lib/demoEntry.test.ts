import { describe, expect, it } from "vitest";
import { demoEntryPath } from "../../lib/demoEntry";
import { DEMO_FIRST_RUN_PATH } from "../../lib/demoData";

describe("demo task handoff entry", () => {
  it("keeps a valid task handoff through demo entry", () => {
    expect(demoEntryPath(new URL("https://researchquest.example/tasks?source=learning-platform&subject=Biology&lesson=Cells&title=Review%20cells")))
      .toBe("/tasks?source=learning-platform&subject=Biology&lesson=Cells&title=Review%20cells");
  });

  it("uses the ordinary first-run topic otherwise", () => {
    expect(demoEntryPath(new URL("https://researchquest.example/"))).toBe(DEMO_FIRST_RUN_PATH);
    expect(demoEntryPath(new URL("https://researchquest.example/tasks?source=other&title=Review"))).toBe(DEMO_FIRST_RUN_PATH);
    expect(demoEntryPath(new URL("https://researchquest.example/tasks?source=learning-platform&title=%20"))).toBe(DEMO_FIRST_RUN_PATH);
  });
});
