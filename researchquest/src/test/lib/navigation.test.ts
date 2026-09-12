import { describe, it, expect, vi, beforeEach } from "vitest";
import { navigate, navigateToPath } from "../../lib/navigation";
import { useAppStore } from "../../store/appStore";

describe("lib/navigation (PR15 item 38)", () => {
  const pushStateSpy = vi.spyOn(window.history, "pushState");

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
    useAppStore.setState({ currentView: "dashboard" });
  });

  it("navigates to the dashboard at /", () => {
    navigate("dashboard");

    expect(useAppStore.getState().currentView).toBe("dashboard");
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/");
    expect(window.location.pathname).toBe("/");
  });

  it("navigates to a bare view at /<view>", () => {
    navigate("tasks");

    expect(useAppStore.getState().currentView).toBe("tasks");
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/tasks");
    expect(window.location.pathname).toBe("/tasks");
  });

  it("navigates to an entity view at /<view>/<id>", () => {
    navigate("notes", "note-123");

    expect(useAppStore.getState().currentView).toBe("notes");
    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/notes/note-123");
    expect(window.location.pathname).toBe("/notes/note-123");
  });

  it("restores a saved deep-link path with its view", () => {
    navigateToPath("/papers/paper-9");

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/papers/paper-9");
    expect(useAppStore.getState().currentView).toBe("papers");
  });

  it("falls back to the dashboard for an invalid path", () => {
    navigateToPath("/nope/not-a-view");

    expect(pushStateSpy).toHaveBeenCalledWith(null, "", "/nope/not-a-view");
    expect(useAppStore.getState().currentView).toBe("dashboard");
  });
});
