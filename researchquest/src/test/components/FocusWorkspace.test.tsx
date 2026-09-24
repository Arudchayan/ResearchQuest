import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";
import { FocusWorkspace } from "../../components/focus/FocusWorkspace";
import { useAppStore } from "../../store/appStore";

const { supabaseInsert, completeTaskMock } = vi.hoisted(() => ({
  supabaseInsert: vi.fn().mockResolvedValue({ error: null }),
  completeTaskMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: supabaseInsert,
    }),
  },
}));
import { awardXP, notifyGamificationResult } from "../../utils/gamification";
import { toast } from "sonner";
import {
  playTimerCompleteSound,
  showTimerCompleteNotification,
  requestNotificationPermission,
  warmupAudio,
} from "../../utils/alerts";
import {
  saveFocusSession,
  FOCUS_SESSION_STORAGE_KEY,
} from "../../components/focus/focusUtils";

// Mock alerts
vi.mock("../../utils/alerts", () => ({
  playTimerCompleteSound: vi.fn(),
  showTimerCompleteNotification: vi.fn(),
  requestNotificationPermission: vi.fn(),
  warmupAudio: vi.fn(),
}));

// Mock hooks
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
  useTasks: () => ({
    tasks: [
      {
        id: "task-1",
        title: "Gym",
        completed: false,
        due_date: new Date().toISOString().slice(0, 10),
      },
    ],
    loading: false,
    completeTask: completeTaskMock,
  }),
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

// Mock UI components
vi.mock("../../components/ui/Skeleton", () => ({
  ListSkeleton: () => <div data-testid="list-skeleton" />,
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("FocusWorkspace", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();

    const storeMock = (selector: any) => {
      return vi.fn();
    };
    (useAppStore as any).mockImplementation(storeMock);
    (useAppStore as any).getState = () => ({
      focusSessionSecondsToday: 0,
      setFocusSessionSecondsToday: vi.fn(),
      setSelectedNote: vi.fn(),
      setSelectedPaper: vi.fn(),
      setCurrentView: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fresh Focus is empty until a target is picked", () => {
    render(<FocusWorkspace userId={userId} />);
    expect(
      screen.getByText(/Design an intentional deep work session/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Select a focus target")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: /Start focus/i });
    expect(startButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByText(/Select a target from Today or the library to enable Start/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("My Note"));
    expect(screen.getByRole("button", { name: /Start focus/i })).not.toBeDisabled();
  });

  it("awards XP upon session completion", async () => {
    render(<FocusWorkspace userId={userId} />);

    // Select the note from "Notes" suggestion group
    // The component renders an accordion for Notes.
    // It's likely collapsed or expanded.
    // The code says: collapsedGroups initial state { note: false } -> Expanded.

    // Find the note button and click it
    const noteButton = screen.getByText("My Note");
    fireEvent.click(noteButton);

    // Now "Start focus" should be enabled.
    const startButton = screen.getByText("Start focus");
    expect(startButton).not.toBeDisabled();

    // Set a custom duration to 1 minute for faster testing?
    // Actually, we use fake timers so duration doesn't matter for speed,
    // but calculation depends on it. Default is 25 min.

    // Click start
    fireEvent.click(startButton);

    // Advance timers by 25 minutes (plus a buffer)
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    // Expect awardXP to be called
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session"); // 25 min * 2 XP/min = 50 XP

    // Expect toast to be shown; the "+N XP" toast is notifyGamificationResult's
    expect(toast.success).toHaveBeenCalledWith(
      "Focus session complete!",
      expect.objectContaining({
        description: expect.stringContaining("25 minutes"),
      }),
    );

    // notifyGamificationResult is the single XP announcement (no skipXpToast)
    expect(notifyGamificationResult).toHaveBeenCalledWith(null);
  });

  it("triggers sound and notification when timer completes", async () => {
    render(<FocusWorkspace userId={userId} />);

    // Select note
    const noteButton = screen.getByText("My Note");
    fireEvent.click(noteButton);

    // Start focus
    const startButton = screen.getByText("Start focus");
    fireEvent.click(startButton);

    // Expect warmup and permission request
    expect(warmupAudio).toHaveBeenCalled();
    expect(requestNotificationPermission).toHaveBeenCalled();

    // Fast forward timer
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    // Expect sound and notification
    expect(playTimerCompleteSound).toHaveBeenCalled();
    expect(showTimerCompleteNotification).toHaveBeenCalledWith(
      "Focus session complete!",
      expect.objectContaining({ body: expect.stringContaining("My Note") }),
    );
  });

  it("lands a stored running session paused with Continue after remount", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByText("20:00")).toBeInTheDocument();

    unmount();

    // Wall clock may still advance while away; the remount must not auto-run.
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("18:00")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("18:00")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("17:00")).toBeInTheDocument();
  });

  it("completes a session that ended while away, awarding XP only once", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    const { unmount: unmountAgain } = render(
      <FocusWorkspace userId={userId} />,
    );
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session");
    expect(supabaseInsert).toHaveBeenCalledTimes(1);

    // A further remount must not re-award XP for the same session.
    unmountAgain();
    render(<FocusWorkspace userId={userId} />);
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(supabaseInsert).toHaveBeenCalledTimes(1);
  });

  it("resets clear the persisted session", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    const { getByText, unmount: unmountAgain } = render(
      <FocusWorkspace userId={userId} />,
    );
    expect(getByText("20:00")).toBeInTheDocument();
    fireEvent.click(getByText("Reset"));

    unmountAgain();
    const next = render(<FocusWorkspace userId={userId} />);
    expect(next.getByText("25:00")).toBeInTheDocument();
    expect(next.getByText("Start focus")).toBeInTheDocument();
  });

  it("StrictMode remount of a stored running session lands paused until Continue", async () => {
    // Seed a running session that started 5 minutes ago.
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now() - 5 * 60 * 1000,
      timeLeft: 20 * 60,
      hasCompletedSession: false,
    });

    const { unmount, getByText, getByRole } = render(
      <StrictMode>
        <FocusWorkspace userId={userId} />
      </StrictMode>,
    );

    // The second StrictMode setup must not wipe the restored session.
    expect(getByText("20:00")).toBeInTheDocument();
    expect(getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(false);
    expect(stored.timeLeft).toBe(20 * 60);

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(getByText("20:00")).toBeInTheDocument();

    fireEvent.click(getByRole("button", { name: /^Continue$/i }));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(getByText("19:00")).toBeInTheDocument();

    // Complete the session while away, then remount in StrictMode.
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    const { unmount: unmountAgain } = render(
      <StrictMode>
        <FocusWorkspace userId={userId} />
      </StrictMode>,
    );

    // StrictMode double-invokes effects, but XP + insert must fire exactly once.
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session");
    expect(supabaseInsert).toHaveBeenCalledTimes(1);

    // A further remount must not re-award the same completed session.
    unmountAgain();
    render(
      <StrictMode>
        <FocusWorkspace userId={userId} />
      </StrictMode>,
    );
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(supabaseInsert).toHaveBeenCalledTimes(1);
  });

  it("uses secondary text tokens for timer metadata on the gridded session chrome", () => {
    render(<FocusWorkspace userId={userId} />);
    const sessionLabel = screen.getByText(/SESSION 01 · 25 MIN · FOCUS/);
    expect(sessionLabel).toHaveClass("text-text-secondary");
    expect(sessionLabel).not.toHaveClass("text-text-tertiary");
    const remainingRow = screen.getByText("Time remaining").parentElement;
    expect(remainingRow).toHaveClass("text-text-secondary");
    expect(remainingRow).not.toHaveClass("text-text-tertiary");
    expect(screen.getByText(/0% complete/)).toBeInTheDocument();
  });

  it("shows a printed session label and increments the ordinal on each fresh start", async () => {
    const { unmount, getByText } = render(<FocusWorkspace userId={userId} />);
    expect(getByText(/SESSION 01 · 25 MIN · FOCUS/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(getByText(/SESSION 01 · 25 MIN · NOTE/)).toBeInTheDocument();

    // Pausing and continuing does not count as a new session.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByText("Pause"));
    expect(getByText("Continue")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue"));
    expect(getByText(/SESSION 01 · 25 MIN · NOTE/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    const storedAfterCompletion = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(storedAfterCompletion.sessionCount).toBe(1);

    // A fresh start after completion is a new session.
    fireEvent.click(screen.getByText("Start focus"));
    expect(getByText(/SESSION 02 · 25 MIN · NOTE/)).toBeInTheDocument();

    const storedAfterRestart = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(storedAfterRestart.sessionCount).toBe(2);

    // The ordinal persists across remounts.
    unmount();
    const next = render(<FocusWorkspace userId={userId} />);
    expect(next.getByText(/SESSION 02 · 25 MIN · NOTE/)).toBeInTheDocument();
  });

  it("renders the completion colophon with the estimated XP when the award fails", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    expect(screen.getByText("Colophon")).toBeInTheDocument();
    expect(screen.getByText(/25 MIN · \+50 XP/)).toBeInTheDocument();
  });

  it("renders the completion colophon with the actually awarded (boosted) XP", async () => {
    vi.mocked(awardXP).mockResolvedValueOnce({
      xpEarned: 75,
      level: 5,
      leveledUp: false,
      streak: 6,
      achievementsEarned: [],
    });

    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    expect(screen.getByText("Colophon")).toBeInTheDocument();
    expect(screen.getByText(/25 MIN · \+75 XP/)).toBeInTheDocument();
  });

  it("offers Mark task done after a task session completes", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("Gym"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark task done?" }));
    expect(completeTaskMock).toHaveBeenCalledWith("task-1");
  });
});
