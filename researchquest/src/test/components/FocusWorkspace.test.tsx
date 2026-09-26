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
  let navigationTypeSpy: ReturnType<typeof vi.spyOn> | undefined;

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

    // Time away must not keep ticking; remount hydrates the last persisted
    // remaining (20:00), not wall-clock 18:00.
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("20:00")).toBeInTheDocument();
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
    expect(view.getByText("20:00")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("19:00")).toBeInTheDocument();
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

  it("does not persist isRunning true after Start", async () => {
    render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(stored.isRunning).toBe(false);
    expect(stored.selectedTarget).toEqual({ type: "note", id: "note-1" });
    expect(stored.startedAt).not.toBeNull();
  });

  it("Start then remount with persisted isRunning true lands Continue, not running", async () => {
    const { unmount } = render(<FocusWorkspace userId={userId} />);
    fireEvent.click(screen.getByText("My Note"));
    fireEvent.click(screen.getByText("Start focus"));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();

    // Crash-style snapshot: storage still says running (wine hard-refresh).
    saveFocusSession({
      version: 1,
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      isRunning: true,
      startedAt: Date.now(),
      timeLeft: 25 * 60,
      hasCompletedSession: false,
      sessionCount: 1,
    });
    unmount();

    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("25:00")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(view.getByText("25:00")).toBeInTheDocument();
  });

  it("cold hydrate from storage (QA hard-refresh) shows Continue and does not auto-tick", async () => {
    // #800 Soft FAIL: 02_after_hard_refresh still Pause at 24:04; 03_after_wait
    // ticked to 23:32. Event-dispatch of pagehide/pageshow is not this path —
    // a hard refresh remounts React and hydrates from rq_focus_session.
    // startedAt is 2 minutes ago so wall-clock remaining would be 23:00 if
    // hydrate were allowed to keep running; last painted remaining is 24:04.
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
    expect(view.getByText("24:04")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    const storedBeforeWait = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    );
    expect(storedBeforeWait.isRunning).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:04")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    expect(view.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("23:46")).toBeInTheDocument();
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

  it("Ctrl+Shift+R hard reload keeps Continue frozen through burst click, then Continue resumes", async () => {
    // Wine Product×2: Ctrl+Shift+R WHILE Pause live still Pause and the
    // clock ticked (24:52→24:37→24:21). New-document hydrate lands Continue,
    // then the session button arms from reload-burst click/focus-restore.
    // Playwright page.reload Soft PASS never replayed that click.
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

    fireEvent.click(view.getByRole("button", { name: /^Continue$/i }));
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

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

  it("bfcache pageshow of a running session lands paused with Continue", async () => {
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByText("24:00")).toBeInTheDocument();
  });

  it("wine hard-refresh pageshow(false) of a live running heap lands Continue, frozen", async () => {
    // Wine Soft FAIL after #801: Start → hard refresh still Pause and the
    // clock kept ticking. Preview Soft PASS remounted React (cold hydrate).
    // Wine reload can keep the heap and fire pageshow(persisted=false)
    // without unmounting FocusWorkspace.
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:43")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
  });

  it("wine same-document replace of a live Pause run lands Continue, frozen", async () => {
    // Preview Soft PASS: Playwright page.reload() → navigationType=reload.
    // Wine Product hard refresh: location.replace(href) → type=replace, heap
    // survives, pagehide remount never paints.
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:48")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
  });

  it("pagehide of a running session (no visibility hide) lands Continue, frozen, then remount stays Continue", async () => {
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:39")).toBeInTheDocument();

    unmount();
    const view = render(<FocusWorkspace userId={userId} />);
    expect(view.getByText("24:39")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByText("24:39")).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
  });

  function KeyedFocusWorkspace({ userId }: { userId: string }) {
    const epoch = useFocusHydrateEpoch();
    return <FocusWorkspace key={epoch} userId={userId} />;
  }

  it("pagehide remounts keyed Focus from rq_focus_session Continue, frozen", async () => {
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("24:39")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:39")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
  });

  it("wine visibility hide of a running session lands Continue and does not auto-tick", async () => {
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:43")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(screen.getByRole("button", { name: /^Pause$/i })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:25")).toBeInTheDocument();

    await act(async () => {
      dispatchVisibility(false);
    });
  });

  it("visibility hide after Continue freezes last painted remaining, not wall-clock since Continue", async () => {
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

    expect(screen.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(screen.getByText("24:41")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(screen.getByText("24:41")).toBeInTheDocument();
  });

  it("wine persistPaused snapshot (isRunning false, startedAt set) hydrates Continue, frozen", async () => {
    // After Start, persistPausedFocusSession writes isRunning:false but keeps
    // startedAt. Wine cold mount must not treat that as permission to run.
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
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(18 * 1000);
    });
    expect(view.getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
    expect(
      view.queryByRole("button", { name: /^Pause$/i }),
    ).not.toBeInTheDocument();
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

    const { getByText, getByRole, unmount: unmountAgain } = render(
      <FocusWorkspace userId={userId} />,
    );
    expect(getByText("25:00")).toBeInTheDocument();
    expect(getByRole("button", { name: /^Continue$/i })).toBeInTheDocument();
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
