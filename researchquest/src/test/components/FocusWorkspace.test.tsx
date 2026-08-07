import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";
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

  it("renders correctly", () => {
    render(<FocusWorkspace userId={userId} />);
    expect(
      screen.getByText(/Design an intentional deep work session/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Start focus/i)).toBeInTheDocument();
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

  it("restores a running session with accurate elapsed time after remount", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByText("20:00")).toBeInTheDocument();

    unmount();

    // Timer keeps "running" (wall clock) while the component is unmounted.
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    const { getByText } = render(<FocusWorkspace userId={userId} />);
    expect(getByText("18:00")).toBeInTheDocument();

    // The restored session is still running and ticks down.
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(getByText("17:00")).toBeInTheDocument();
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

  it("StrictMode double-mount keeps a restored running session intact and awards XP exactly once", async () => {
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

    const { unmount, getByText } = render(
      <StrictMode>
        <FocusWorkspace userId={userId} />
      </StrictMode>,
    );

    // The second StrictMode setup must not wipe the restored session.
    expect(getByText("20:00")).toBeInTheDocument();

    // Storage must still hold the running session after the double-mount.
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.timeLeft).toBe(20 * 60);

    // The restored timer continues ticking.
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

  it("shows a printed session label and increments the ordinal on each fresh start", async () => {
    const { unmount, getByText } = render(<FocusWorkspace userId={userId} />);
    expect(getByText(/SESSION 01 · 25 MIN · FOCUS/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(getByText(/SESSION 01 · 25 MIN · NOTE/)).toBeInTheDocument();

    // Pausing and resuming does not count as a new session.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByText("Pause"));
    expect(getByText("Resume")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Resume"));
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
});
