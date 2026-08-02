import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { FocusWorkspace } from "../../components/focus/FocusWorkspace";
import { useAppStore } from "../../store/appStore";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));
import { awardXP } from "../../utils/gamification";
import { toast } from "sonner";
import {
  playTimerCompleteSound,
  showTimerCompleteNotification,
  requestNotificationPermission,
  warmupAudio,
} from "../../utils/alerts";

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
  awardXP: vi.fn(),
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
  let setFocusSessionSecondsTodayMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setFocusSessionSecondsTodayMock = vi.fn();

    const storeMock = (selector: any) => {
      return vi.fn();
    };
    (useAppStore as any).mockImplementation(storeMock);
    (useAppStore as any).getState = () => ({
      focusSessionSecondsToday: 0,
      setFocusSessionSecondsToday: setFocusSessionSecondsTodayMock,
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

    // Expect toast to be shown
    expect(toast.success).toHaveBeenCalledWith(
      "Focus session complete!",
      expect.objectContaining({
        description: expect.stringContaining("50 XP"),
      }),
    );
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

  it("does not locally increment today's focus seconds after completion", async () => {
    render(<FocusWorkspace userId={userId} />);

    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
      await Promise.resolve();
    });

    expect(setFocusSessionSecondsTodayMock).not.toHaveBeenCalled();
  });
});
