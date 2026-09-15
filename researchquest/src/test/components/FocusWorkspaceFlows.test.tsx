import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { FocusWorkspace } from "../../components/focus/FocusWorkspace";
import { useAppStore } from "../../store/appStore";

const { supabaseInsert } = vi.hoisted(() => ({
  supabaseInsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: supabaseInsert,
    }),
  },
}));
import { awardXP } from "../../utils/gamification";
import { toast } from "sonner";
import { FOCUS_SESSION_STORAGE_KEY } from "../../components/focus/focusUtils";

vi.mock("../../utils/alerts", () => ({
  playTimerCompleteSound: vi.fn(),
  showTimerCompleteNotification: vi.fn(),
  requestNotificationPermission: vi.fn(),
  warmupAudio: vi.fn(),
}));

vi.mock("../../hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [
      {
        id: "note-1",
        title: "My Note",
        markdown_body: "Content",
        updated_at: new Date().toISOString(),
      },
    ],
    loading: false,
  }),
}));
vi.mock("../../hooks/usePapers", () => ({
  usePapers: () => ({ papers: [], loading: false }),
}));
vi.mock("../../hooks/useTasks", () => ({
  useTasks: () => ({ tasks: [], loading: false }),
}));
vi.mock("../../store/appStore", () => ({
  useAppStore: vi.fn(),
}));
vi.mock("../../utils/gamification", () => ({
  XP_REWARDS: { FOCUS_SESSION_MINUTE: 2 },
  awardXP: vi.fn().mockResolvedValue(null),
  notifyGamificationResult: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("../../components/ui/Skeleton", () => ({
  ListSkeleton: () => <div data-testid="list-skeleton" />,
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("FocusWorkspace flows (PR19 item 78)", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();

    const fakeState = {
      focusSessionSecondsToday: 0,
      setFocusSessionSecondsToday: vi.fn(),
      setSelectedNote: vi.fn(),
      setSelectedPaper: vi.fn(),
      setCurrentView: vi.fn(),
    };
    (useAppStore as any).mockImplementation((selector: any) =>
      selector(fakeState),
    );
    (useAppStore as any).getState = () => fakeState;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("explains why Start focus is disabled until a target is picked", () => {
    render(<FocusWorkspace userId={userId} />);

    const startButton = screen.getByText("Start focus");
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAttribute("aria-describedby", "start-focus-hint");
    expect(
      screen.getByText("Pick a target from the lists to enable the timer."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("My Note"));

    expect(screen.getByText("Start focus")).not.toBeDisabled();
    expect(
      screen.queryByText("Pick a target from the lists to enable the timer."),
    ).not.toBeInTheDocument();
  });

  it("keeps showing the target name when the target was deleted", () => {
    window.localStorage.setItem(
      FOCUS_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedTarget: { type: "note", id: "deleted-note" },
        selectedTargetName: "Deleted Note Title",
        sessionLength: 1500,
        isRunning: false,
        startedAt: null,
        timeLeft: 1500,
        hasCompletedSession: false,
      }),
    );

    render(<FocusWorkspace userId={userId} />);

    // The remembered name survives instead of resetting to the empty state.
    expect(screen.getByText("Deleted Note Title")).toBeInTheDocument();
    expect(
      screen.getByText(/is no longer available/, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing selected yet"),
    ).not.toBeInTheDocument();

    // The timer stays disabled, with the helper text explaining why.
    expect(screen.getByText("Start focus")).toBeDisabled();
    expect(
      screen.getByText("Pick a target from the lists to enable the timer."),
    ).toBeInTheDocument();
  });

  it("warns up front and toasts when a sub-minute session earns no XP", async () => {
    window.localStorage.setItem(
      FOCUS_SESSION_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        selectedTarget: { type: "note", id: "note-1" },
        selectedTargetName: "My Note",
        sessionLength: 30,
        isRunning: false,
        startedAt: null,
        timeLeft: 30,
        hasCompletedSession: false,
      }),
    );

    render(<FocusWorkspace userId={userId} />);

    expect(
      screen.getByText("Sessions under 1 minute earn no XP."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(31 * 1000);
    });

    expect(awardXP).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "Focus session complete!",
      expect.objectContaining({
        description: expect.stringContaining("under a minute"),
      }),
    );
  });

  it("clamps an over-max custom duration visibly instead of silently", () => {
    render(<FocusWorkspace userId={userId} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. 35"), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(
      screen.getByText("Custom duration limited to 180 minutes (max)."),
    ).toBeInTheDocument();
    // 180 minutes applied: the timer shows 180:00 and the preset colophon updates.
    expect(screen.getByText("180:00")).toBeInTheDocument();
  });

  it("rejects a non-positive custom duration with feedback", () => {
    render(<FocusWorkspace userId={userId} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. 35"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("Apply"));

    expect(
      screen.getByText("Enter a duration of at least 1 minute."),
    ).toBeInTheDocument();
  });
});
