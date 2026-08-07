import { describe, expect, it } from "vitest";
import { cn } from "../../lib/utils";

describe("cn", () => {
  it("merges conflicting font-size classes last-wins", () => {
    expect(cn("text-xs", "text-small")).toBe("text-small");
    expect(cn("text-caption", "text-sm")).toBe("text-sm");
  });

  it("keeps custom text tokens together with text color classes", () => {
    expect(cn("text-small", "text-text-tertiary")).toBe(
      "text-small text-text-tertiary",
    );
    expect(cn("text-caption", "text-text-secondary")).toBe(
      "text-caption text-text-secondary",
    );
  });

  it("keeps only one custom text size when they conflict", () => {
    expect(cn("text-small", "text-caption")).toBe("text-caption");
  });
});
