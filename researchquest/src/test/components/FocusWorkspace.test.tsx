import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";
import { FocusWorkspace } from "../../components/focus/FocusWorkspace";
import { useAppStore } from "../../store/appStore";
import {
  ensureFocusSessionGuardAttached,
  publishLiveFocusSnapshot,
  useFocusHydrateEpoch,
} from "../../components/focus/focusSessionGuard";

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
  persistPausedFocusSession,
  rewriteStoredFocusSessionPaused,
  FOCUS_SESSION_STORAGE_KEY,
} from "../../components/focus/focusUtils";
import {
  initialFocusTimerData,
  useFocusTimerStore,
} from "../../store/focusTimerStore";

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
  // Mirror of the real client gate (sessions below 25 min earn 0 XP).
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

// Mock UI components
vi.mock("../../components/ui/Skeleton", () => ({
  ListSkeleton: () => <div data-testid="list-skeleton" />,
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("FocusWorkspace", () => {
  const userId = "user-123";
  let navigationTypeSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();
    // The live timer store is a module singleton: reset it so each test
    // starts from a clean slate (localStorage.clear alone cannot).
    useFocusTimerStore.setState({ ...initialFocusTimerData });

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
    navigationTypeSpy?.mockRestore();
    navigationTypeSpy = undefined;
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

  it("visibility hide without a stored session stays Start-only, not Continue", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    expect(screen.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(true);
    });

    expect(screen.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("cold remount with no stored rq_focus_session lands Start-only", () => {
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    expect(screen.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    unmount();
    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("Reset then visibility hide stays Start-only, not Continue", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(true);
    });

    expect(screen.getByRole("button", { name: /Start focus/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
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
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session", {
      durationMinutes: 25,
    }); // 25 min * 2 XP/min = 50 XP

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

  it("remount mid-session resumes the live countdown from the deadline", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByText("20:00")).toBeInTheDocument();

    unmount();

    // Time away counts down against the deadline (25:00 - 5:00 live - 2:00
    // away = 18:00), it is not frozen or reset.
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("18:00")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.deadline).toBeGreaterThan(Date.now());

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("17:00")).toBeInTheDocument();
  });

  function dispatchPageHide() {
    window.dispatchEvent(new Event("pagehide"));
  }

  function dispatchPageShow(persisted: boolean) {
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", {
      configurable: true,
      value: persisted,
    });
    window.dispatchEvent(event);
  }

  function dispatchReplaceNavigate() {
    if (!(window as Window & { navigation?: EventTarget }).navigation) {
      Object.defineProperty(window, "navigation", {
        configurable: true,
        value: new EventTarget(),
      });
    }
    ensureFocusSessionGuardAttached();
    const event = new Event("navigate");
    Object.defineProperty(event, "navigationType", {
      configurable: true,
      value: "replace",
    });
    Object.defineProperty(event, "destination", {
      configurable: true,
      value: { url: window.location.href },
    });
    (
      window as Window & { navigation: EventTarget }
    ).navigation.dispatchEvent(event);
  }

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

  it("persists the live run with isRunning true and a deadline after Start", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    // Deadline-derived countdown: the live snapshot carries the deadline so
    // any remount can resume instead of freezing.
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.selectedTarget).toEqual({ type: "note", id: "note-1" });
    expect(stored.startedAt).not.toBeNull();
    expect(stored.deadline).toBe(stored.startedAt + 25 * 60 * 1000);
  });

  it("cold hydrate of a deadline snapshot resumes live from the deadline", async () => {
    // Crash-style snapshot WITH a deadline: the 2 minutes since start count
    // down (25:00 - 2:00 = 23:00) and the run resumes live, not Continue.
    const startedAt = Date.now() - 2 * 60 * 1000;
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt,
      deadline: startedAt + 25 * 60 * 1000,
      timeLeft: 25 * 60,
      hasCompletedSession: false,
      sessionCount: 1,
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("23:00")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("22:00")).toBeInTheDocument();
  });

  it("cold hydrate from storage (QA hard-refresh) resumes the live countdown", async () => {
    // A hard refresh remounts React and hydrates from rq_focus_session.
    // startedAt is 2 minutes ago, so the reconstructed deadline
    // (startedAt + sessionLength) shows 23:00 and keeps ticking live.
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now() - 2 * 60 * 1000,
      timeLeft: 24 * 60 + 4,
      hasCompletedSession: false,
      sessionCount: 1,
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("23:00")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    const storedBeforeWait = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(storedBeforeWait.isRunning).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("22:42")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Pause$/i }));
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("22:42")).toBeInTheDocument();
  });

  it("wine new-document delayed mount (App skeleton, no pagehide) Continue frozen at last painted remaining", async () => {
    // Binding: Preview Soft PASS on c1aa8be dispatched pagehide on a live heap
    // (Playwright page.reload). Wine hard refresh is a new document: the dying
    // page's epoch remount never paints, and App shows a loading skeleton
    // before lazy Focus mounts. Do not dispatch pagehide/pageshow here.
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now() - 12 * 1000,
      timeLeft: 24 * 60 + 48,
      hasCompletedSession: false,
      sessionCount: 1,
    });
    rewriteStoredFocusSessionPaused();
    publishLiveFocusSnapshot(null);

    function DelayedFocus({
      userId,
      ready,
    }: {
      userId: string;
      ready: boolean;
    }) {
      if (!ready) return <div>Loading view…</div>;
      return <FocusWorkspace userId={userId} />;
    }

    const view = render(<DelayedFocus userId={userId} ready={false} />);
    expect(view.getByText("Loading view…")).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
    view.rerender(<DelayedFocus userId={userId} ready={true} />);

    expect(view.getByText("24:48")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:48")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:30")).toBeInTheDocument();
  });

  function mockHardDocumentReload() {
    navigationTypeSpy = vi
      .spyOn(performance, "getEntriesByType")
      .mockImplementation((type) => {
        if (type === "navigation") {
          return [{ type: "reload" } as PerformanceNavigationTiming];
        }
        return [];
      });
  }

  it("hard reload hydrate of a paused snapshot shows Continue frozen, then Continue resumes live", async () => {
    // Pre-fix style snapshot without a deadline restores as a paused
    // Continue-hold at the last painted remaining — no spurious wall-clock
    // jump — and Continue resumes the live countdown from there.
    mockHardDocumentReload();
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now() - 8 * 1000,
      timeLeft: 24 * 60 + 52,
      hasCompletedSession: false,
      sessionCount: 1,
    });
    rewriteStoredFocusSessionPaused();

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("24:52")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(15 * 1000);
    });
    expect(view.getByText("24:52")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:34")).toBeInTheDocument();
  });

  it("Ctrl+Shift+R empty Focus stays Start-only; Start then Pause still work immediately", async () => {
    mockHardDocumentReload();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
    render(<FocusWorkspace userId={userId} />);
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start focus/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5 * 1000);
    });
    expect(screen.getByText("24:55")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pause$/i }));
    expect(
      screen.getByRole("button", { name: /^Continue$/i }),
    ).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(5 * 1000);
    });
    expect(screen.getByText("24:55")).toBeInTheDocument();
  });

  it("hard refresh (new heap) boot-rewrites rq_focus_session then cold-hydrates Continue frozen", async () => {
    // Wine Soft FAIL @ 7a9fdd27: Start → hard refresh still Pause + tick.
    // Playwright page.reload Soft PASS was live-heap pagehide, not a new
    // document. Real hard refresh never paints that remount — Continue must
    // come from paused storage + a fresh FocusWorkspace mount.
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: true,
      liveStartedAt: Date.now() - 5 * 1000,
      timeLeft: 24 * 60 + 55,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: false,
    });
    rewriteStoredFocusSessionPaused();

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("24:55")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:55")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:37")).toBeInTheDocument();
  });

  it("bfcache pageshow of a running session keeps the live countdown running", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchPageShow(true);
    });

    // A live run is never frozen by page lifecycle events.
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("23:00")).toBeInTheDocument();
  });

  it("pageshow(false) of a live running heap keeps ticking, never Continue", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(17 * 1000);
    });
    expect(screen.getByText("24:43")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchPageShow(false);
    });

    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
  });

  it("same-document replace of a live run keeps ticking, never Continue", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(12 * 1000);
    });
    expect(screen.getByText("24:48")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchReplaceNavigate();
    });

    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pause$/i }));
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
  });

  it("pagehide of a running session (no visibility hide) keeps ticking, and remount resumes live", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(21 * 1000);
    });
    expect(screen.getByText("24:39")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchPageHide();
    });

    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:21")).toBeInTheDocument();

    unmount();
    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("24:21")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:03")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
  });

  function KeyedFocusWorkspace({ userId }: { userId: string }) {
    const epoch = useFocusHydrateEpoch();
    return <FocusWorkspace key={epoch} userId={userId} />;
  }

  it("pagehide remounts keyed Focus from the live run, still ticking", async () => {
    render(<KeyedFocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(21 * 1000);
    });
    expect(screen.getByText("24:39")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchPageHide();
    });

    // The hydrate-epoch remount resumes the same live deadline — no freeze.
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("24:39")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:21")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
  });

  it("visibility hide of a running session keeps ticking against the deadline", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(17 * 1000);
    });
    expect(screen.getByText("24:43")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(true);
    });

    // Hiding the tab never pauses: the run stays live and wall time counts.
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(awardXP).not.toHaveBeenCalled();

    await act(async () => {
      dispatchVisibility(false);
    });
    expect(screen.getByText("24:25")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Pause$/i }));
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:25")).toBeInTheDocument();
  });

  it("visibility hide after resume keeps ticking against the shifted deadline", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    await act(async () => {
      vi.advanceTimersByTime(17 * 1000);
    });
    fireEvent.click(screen.getByRole("button", { name: /^Pause$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await act(async () => {
      vi.advanceTimersByTime(2 * 1000);
    });
    expect(screen.getByText("24:41")).toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(true);
    });

    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:23")).toBeInTheDocument();
  });

  it("live persistPaused snapshot hydrates running against the reconstructed deadline", async () => {
    // persistPausedFocusSession writes a live run through (isRunning true with
    // its startedAt anchor). A cold mount resumes it live against the
    // reconstructed deadline instead of freezing at the last paint.
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: true,
      liveStartedAt: Date.now() - 17 * 1000,
      timeLeft: 24 * 60 + 43,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: false,
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("24:43")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Continue$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:25")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
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
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session", {
      durationMinutes: 25,
    });
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

    // The remount resumes the live run against the deadline (20:00), and
    // Reset returns to an idle Start-only session with storage cleared.
    const { getByText, getByRole, queryByRole, unmount: unmountAgain } = render(
      <FocusWorkspace userId={userId} />,
    );
    expect(getByText("20:00")).toBeInTheDocument();
    expect(getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    fireEvent.click(getByText("Reset"));
    expect(getByText("25:00")).toBeInTheDocument();
    expect(getByText("Start focus")).toBeInTheDocument();
    expect(queryByRole("button", { name: /^Continue$/i })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();

    unmountAgain();
    const next = render(<FocusWorkspace userId={userId} />);
    expect(next.getByText("25:00")).toBeInTheDocument();
    expect(next.getByText("Start focus")).toBeInTheDocument();
  });

  it("StrictMode remount of a stored running session resumes live and completes exactly once", async () => {
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

    // The second StrictMode setup must not wipe the restored session. The
    // seeded run (started 5 minutes ago) resumes live against the wall clock.
    expect(getByText("20:00")).toBeInTheDocument();
    expect(getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(true);
    expect(stored.timeLeft).toBe(20 * 60);

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(getByText("19:00")).toBeInTheDocument();

    fireEvent.click(getByRole("button", { name: /^Pause$/i }));
    expect(getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /^Continue$/i }));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(getByText("18:00")).toBeInTheDocument();

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
    expect(awardXP).toHaveBeenCalledWith(userId, 50, "complete_focus_session", {
      durationMinutes: 25,
    });
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

  it("lets you start a freeform session without an entity", () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.change(screen.getByLabelText("Focus without an entity"), {
      target: { value: "Write the outline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(screen.getByRole("heading", { name: "Write the outline" })).toBeInTheDocument();
    expect(screen.getByText("Start focus")).not.toBeDisabled();
  });
});
