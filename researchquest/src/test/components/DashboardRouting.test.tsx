import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Dashboard } from "../../components/dashboard/Dashboard";
import { useAppStore } from "../../store/appStore";

describe("Dashboard routing", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    useAppStore.setState({
      currentView: "dashboard",
      user: {
        id: "user-1",
        username: "Scholar",
        total_xp: 100,
        current_level: 1,
        current_streak: 0,
        longest_streak: 0,
        streak_freeze_tokens: 0,
        rest_days: 0,
        active_boost: null,
        theme_preference: "light",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      notes: [],
      papers: [],
      tasks: [],
      notesLoading: false,
      papersLoading: false,
      tasksLoading: false,
    });
  });

  it("navigates to /notes from the recent notes action", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /view all/i }));

    expect(window.location.pathname).toBe("/notes");
    expect(useAppStore.getState().currentView).toBe("notes");
  });
});
