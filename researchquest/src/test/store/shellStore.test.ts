import { describe, expect, it } from "vitest";
import { useShellStore } from "../../store/shellStore";

describe("shellStore setCurrentView", () => {
  it("does not allocate a new state object when the view is unchanged", () => {
    useShellStore.setState({ currentView: "notes" });
    const before = useShellStore.getState();
    useShellStore.getState().setCurrentView("notes");
    expect(useShellStore.getState()).toBe(before);
  });

  it("updates when the view changes", () => {
    useShellStore.setState({ currentView: "notes" });
    useShellStore.getState().setCurrentView("papers");
    expect(useShellStore.getState().currentView).toBe("papers");
  });
});
