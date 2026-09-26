import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
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
import { awardXP } from "../../utils/gamification";

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
  xpForFocusSession: (durationMinutes: number) =>
    Number.isFinite(durationMinutes) && durationMinutes >= 25
      ? Math.floor(durationMinutes) * 2
      : 0,
  awardXP: vi.fn().mockResolvedValue(null),
  notifyGamificationResult: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

function dispatchVisibility(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Parse the big MM:SS timer readout into seconds. */
function readTimerSeconds(): number {
  const matches = screen.queryAllByText(/^\d{2}:\d{2}$/);
  expect(matches.length).toBeGreaterThan(0);
  const [mins, secs] = matches[0].textContent!.split(":").map(Number);
  return mins * 60 + secs;
}

async function startNoteSession() {
  render(<FocusWorkspace userId="user-123" />);
  fireEvent.click(screen.getByText("My Note"));
  fireEvent.click(screen.getByText("Start focus"));
  expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
}

describe("Focus timer persistence (deadline-based)", () => {
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
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("unmount/remount mid-session is deadline-based: time away counts down, not frozen or reset", async () => {
    const { unmount } = render(<FocusWorkspace userId="user-123" />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();

    unmount();

    // 2 minutes pass while unmounted (navigated away).
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    const view = render(<FocusWorkspace userId="user-123" />);
    // Deadline: 25:00 - 60s live - 120s away = 22:00.
    expect(view.getByText("22:00")).toBeInTheDocument();
    expect(view.queryByText("25:00")).not.toBeInTheDocument();
    expect(awardXP).not.toHaveBeenCalled();
  });

  it("hidden-tab time counts down: returning shows deadline-based remaining without remount", async () => {
    await startNoteSession();
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(true);
    });
    await act(async () => {
      vi.advanceTimersByTime(120 * 1000);
    });
    await act(async () => {
      dispatchVisibility(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Deadline: 25:00 - 60s live - 120s hidden - ~1s back ≈ 21:59.
    // Assert with tolerance: the hidden 120s MUST have counted down
    // (frozen would still read 24:00 = 1440s).
    const remaining = readTimerSeconds();
    expect(remaining).toBeLessThanOrEqual(22 * 60);
    expect(remaining).toBeGreaterThan(21 * 60);
    expect(awardXP).not.toHaveBeenCalled();
  });

  it("hidden-tab passage past the deadline completes exactly once on return", async () => {
    const { unmount } = render(<FocusWorkspace userId="user-123" />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      dispatchVisibility(true);
    });
    // Whole session elapses while the tab is hidden.
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });
    await act(async () => {
      dispatchVisibility(false);
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(awardXP).toHaveBeenCalledWith(
      "user-123",
      50,
      "complete_focus_session",
      { durationMinutes: 25 },
    );
    expect(supabaseInsert).toHaveBeenCalledTimes(1);

    // No double-complete on further ticks…
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(supabaseInsert).toHaveBeenCalledTimes(1);

    // …nor on remount after completion.
    unmount();
    render(<FocusWorkspace userId="user-123" />);
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(awardXP).toHaveBeenCalledTimes(1);
    expect(supabaseInsert).toHaveBeenCalledTimes(1);
  });

  it("pause/resume shifts the deadline: the paused gap does not count down", async () => {
    await startNoteSession();
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pause$/i }));
    expect(
      screen.getByRole("button", { name: /^Continue$/i }),
    ).toBeInTheDocument();

    // 5 paused minutes must not move the deadline.
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("23:00")).toBeInTheDocument();
    expect(awardXP).not.toHaveBeenCalled();
  });
});
