import { describe, it, expect } from "vitest";
import { singleDeleteCopy, bulkDeleteCopy } from "../../utils/deleteModel";

describe("deleteModel copy", () => {
  it("names the item and states the undo window for single deletes", () => {
    const copy = singleDeleteCopy("idea", "My idea");
    expect(copy.title).toBe("Delete idea");
    expect(copy.message).toBe(
      'Are you sure you want to delete "My idea"? You can undo for a short time after deleting.',
    );
    expect(copy.confirmText).toBe("Delete");
    expect(copy.cancelText).toBe("Cancel");
  });

  it("falls back to an untitled name when the title is blank", () => {
    const copy = singleDeleteCopy("note", "   ");
    expect(copy.message).toContain('"Untitled note"');
  });

  it("appends the links note for topics", () => {
    const copy = singleDeleteCopy("topic", "Thesis", { linksNote: true });
    expect(copy.title).toBe("Delete topic");
    expect(copy.message).toContain("This will remove its links");
    expect(copy.message).toContain("You can undo");
  });

  it("uses cannot-be-undone copy for bulk deletes", () => {
    const copy = bulkDeleteCopy();
    expect(copy.title).toBe("Clear all research data");
    expect(copy.message).toContain("It cannot be undone.");
    expect(copy.confirmText).toBe("Delete everything");
  });
});
