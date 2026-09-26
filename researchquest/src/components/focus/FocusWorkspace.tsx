import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Target,
  BookOpen,
  FileText,
  CheckSquare,
  Sparkles,
  Info,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
} from "lucide-react";
import { useNotes } from "../../hooks/useNotes";
import { usePapers } from "../../hooks/usePapers";
import { useTasks } from "../../hooks/useTasks";
import { useAppStore } from "../../store/appStore";
import { navigateToView } from "../../lib/softNavigation";
import {
  resolveTodayTasks,
  useTodayPlanStore,
} from "../../store/todayPlanStore";
import type { Note, Paper, Task } from "../../types/database";
import { awardXP, notifyGamificationResult, XP_REWARDS } from "../../utils/gamification";
import {
  playTimerCompleteSound,
  showTimerCompleteNotification,
  requestNotificationPermission,
  warmupAudio,
} from "../../utils/alerts";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { PageHeader } from "../ui/PageHeader";
import {
  type FocusTargetType,
  type SelectedTarget,
  type CollapsedGroups,
  type CollapsiblePanel,
  formatTime,
  extractNoteSummary,
  extractNotePreview,
  extractPaperPreview,
  extractTaskPreview,
  loadStoredFocusSession,
  persistPausedFocusSession,
  remainingSecondsOnRestore,
  restoredSessionNeedsContinue,
  rewriteStoredFocusSessionPaused,
  isFocusDocumentReload,
  FOCUS_DOCUMENT_RELOAD_START_QUIET_MS,
} from "./focusUtils";
import {
  bumpFocusRunEpoch,
  currentFocusRunEpoch,
  publishLiveFocusSnapshot,
  registerFocusFreeze,
} from "./focusSessionGuard";
import { FocusTargetAside } from "./FocusTargetAside";

const DEFAULT_SESSION_LENGTH = 25 * 60;

interface FocusWorkspaceProps {
  userId: string | undefined;
}

export function FocusWorkspace({ userId }: FocusWorkspaceProps) {
  const { notes, loading: notesLoading } = useNotes(userId);
  const { papers, loading: papersLoading } = usePapers(userId);
  const { tasks, loading: tasksLoading, completeTask } = useTasks(userId, {
    owner: false,
  });
  const todayOrderedIds = useTodayPlanStore((state) => state.orderedIds);

  const setSelectedNote = useAppStore((state) => state.setSelectedNote);
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper);

  const [restoredSession] = useState(() => loadStoredFocusSession());

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    restoredSession?.selectedTarget ?? null,
  );

  useEffect(() => {
    const pendingId = useTodayPlanStore.getState().consumePendingFocusTaskId();
    if (pendingId) {
      setSelectedTarget({ type: "task", id: pendingId });
    }
  }, []);
  const [sessionLength, setSessionLength] = useState(
    restoredSession?.sessionLength ?? DEFAULT_SESSION_LENGTH,
  );
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!restoredSession) return DEFAULT_SESSION_LENGTH;
    return remainingSecondsOnRestore(restoredSession);
  });
  // Restored snapshots land paused. Storage may remember task/elapsed; live
  // isRunning is never copied, and the interval stays disarmed until Continue.
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [resumeHold, setResumeHold] = useState(() =>
    restoredSessionNeedsContinue(restoredSession),
  );
  const [customMinutes, setCustomMinutes] = useState("");
  const [hasCompletedSession, setHasCompletedSession] = useState(
    restoredSession?.hasCompletedSession ?? false,
  );
  const [sessionCount, setSessionCount] = useState(
    restoredSession?.sessionCount ?? 0,
  );
  // State (not a ref): the award resolves asynchronously AFTER the colophon's
  // first render (hasCompletedSession flips synchronously), so the colophon
  // must re-render with the actually credited (boosted) amount once it lands.
  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return (
      window.localStorage.getItem("rq_focus_onboarding_dismissed") !== "true"
    );
  });
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroups>({
    note: false,
    paper: false,
    task: false,
  });
  const [collapsedPanels, setCollapsedPanels] = useState<
    Record<CollapsiblePanel, boolean>
  >({
    suggestions: false,
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);

  // ⚡ PERFORMANCE OPTIMIZATION: Use Array.find() instead of pre-computing Maps for single lookups
  // This avoids O(N) memory allocation and iteration on every list update when we only need to find one item
  const selectedItem = useMemo(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.type === "note") {
      return notes.find((note) => note.id === selectedTarget.id) || null;
    }
    if (selectedTarget.type === "paper") {
      return papers.find((paper) => paper.id === selectedTarget.id) || null;
    }
    if (selectedTarget.type === "task") {
      return tasks.find((task) => task.id === selectedTarget.id) || null;
    }
    return null;
  }, [notes, papers, tasks, selectedTarget]);

  useEffect(() => {
    if (restoredSession) return;
    setTimeLeft(sessionLength);
    setIsRunning(false);
    setStartedAt(null);
    setHasCompletedSession(false);
  }, [sessionLength, selectedTarget?.id, restoredSession]);

  const sessionAwardedRef = useRef(false);

  const completeSession = useCallback(() => {
    if (sessionAwardedRef.current) return;
    sessionAwardedRef.current = true;

    setIsRunning(false);
    setStartedAt(null);
    setHasCompletedSession(true);

    if (isSoundEnabled) {
      playTimerCompleteSound();
    }

    if (isNotificationEnabled) {
      const targetName = selectedItem
        ? selectedTarget?.type === "note"
          ? extractNoteSummary(selectedItem as Note)
          : selectedTarget?.type === "paper"
            ? (selectedItem as Paper).title
            : (selectedItem as Task).title
        : "Focus Session";

      showTimerCompleteNotification("Focus session complete!", {
        body: `You completed your session on ${targetName}.`,
      });
    }

    if (userId) {
      const durationMinutes = Math.floor(sessionLength / 60);
      const xpEarned = durationMinutes * XP_REWARDS.FOCUS_SESSION_MINUTE;

      if (xpEarned > 0) {
        awardXP(userId, xpEarned, "complete_focus_session")
          .then((result) => {
            setAwardedXp(result?.xpEarned ?? null);
            notifyGamificationResult(result);
          })
          .catch((err) => logger.error("Failed to award XP", err));
        toast.success("Focus session complete!", {
          description: `You completed ${durationMinutes} minutes of focus.`,
          ...(selectedTarget?.type === "task"
            ? {
                action: {
                  label: "Mark task done?",
                  onClick: () => {
                    void completeTask(selectedTarget.id);
                  },
                },
              }
            : {}),
        });
      }

      void supabase
        .from("focus_sessions")
        .insert({
          user_id: userId,
          duration_seconds: sessionLength,
          target_type: selectedTarget?.type ?? null,
          target_id: selectedTarget?.id ?? null,
        })
        .then(({ error }) => {
          if (error) {
            logger.error("[RQ] focus_sessions insert failed", error);
            return;
          }
          const { focusSessionSecondsToday, setFocusSessionSecondsToday } =
            useAppStore.getState();
          setFocusSessionSecondsToday(
            focusSessionSecondsToday + sessionLength,
          );
        });
    }
  }, [
    userId,
    isSoundEnabled,
    isNotificationEnabled,
    selectedItem,
    selectedTarget,
    sessionLength,
    completeTask,
  ]);

  const completeSessionRef = useRef(completeSession);
  completeSessionRef.current = completeSession;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Start/Continue in this mount is the only way the interval may run.
  // Hydrate and lifecycle freeze must not leave isRunning true able to
  // restart the timer when completeSession's identity changes.
  const runArmedRef = useRef(false);
  // Wine Ctrl+Shift+R WHILE Pause live: hydrate lands Continue, then a
  // reload-burst click / focus-restore keyup hits the same button and
  // arms Pause. Ignore Start/Continue until this timestamp; Pause always
  // works. Gated on navigation type=reload so in-session remount tests
  // (no reload entry) keep immediate Continue.
  const reloadStartQuietUntilRef = useRef(0);

  const stopTimerNow = () => {
    if (timerRef.current == null) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (!isRunning || !runArmedRef.current) {
      stopTimerNow();
      return;
    }

    const epoch = currentFocusRunEpoch();
    const timer = window.setInterval(() => {
      if (epoch !== currentFocusRunEpoch()) {
        window.clearInterval(timer);
        if (timerRef.current === timer) timerRef.current = null;
        return;
      }
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          if (timerRef.current === timer) timerRef.current = null;
          runArmedRef.current = false;
          completeSessionRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = timer;

    return () => {
      window.clearInterval(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [isRunning]);

  useEffect(() => {
    if (hasCompletedSession || !restoredSession || timeLeft > 0) {
      return;
    }
    completeSession();
  }, [hasCompletedSession, restoredSession, timeLeft, completeSession]);

  const isLoading = notesLoading || papersLoading || tasksLoading;
  const effectiveTimeLeft = Math.max(0, timeLeft);
  const isPaused =
    !isRunning &&
    !hasCompletedSession &&
    effectiveTimeLeft > 0 &&
    (effectiveTimeLeft < sessionLength || resumeHold);
  const progress =
    sessionLength > 0 ? (sessionLength - effectiveTimeLeft) / sessionLength : 0;
  const durationMinutes = Math.floor(sessionLength / 60);
  const xpEarned = durationMinutes * XP_REWARDS.FOCUS_SESSION_MINUTE;
  const sessionOrdinal = Math.max(1, sessionCount);

  useEffect(() => {
    persistPausedFocusSession({
      selectedTarget,
      sessionLength,
      liveIsRunning: isRunning,
      liveStartedAt: startedAt,
      timeLeft: effectiveTimeLeft,
      hasCompletedSession,
      sessionCount,
      keepAlive: resumeHold,
    });
  }, [
    isRunning,
    startedAt,
    hasCompletedSession,
    resumeHold,
    selectedTarget,
    sessionLength,
    effectiveTimeLeft,
    sessionCount,
  ]);

  const persistRef = useRef({
    isRunning,
    startedAt,
    selectedTarget,
    sessionLength,
    timeLeft: effectiveTimeLeft,
    hasCompletedSession,
    sessionCount,
    resumeHold,
  });
  persistRef.current = {
    isRunning,
    startedAt,
    selectedTarget,
    sessionLength,
    timeLeft: effectiveTimeLeft,
    hasCompletedSession,
    sessionCount,
    resumeHold,
  };
  publishLiveFocusSnapshot({
    selectedTarget,
    sessionLength,
    timeLeft: effectiveTimeLeft,
    hasCompletedSession,
    sessionCount,
    isLive: isRunning || runArmedRef.current,
    resumeHold,
  });

  const freezeLiveToContinue = () => {
    stopTimerNow();
    runArmedRef.current = false;
    bumpFocusRunEpoch();
    const snap = persistRef.current;
    const remaining = snap.timeLeft;
    const inProgress =
      snap.isRunning ||
      snap.resumeHold ||
      (snap.selectedTarget !== null && remaining < snap.sessionLength);
    persistRef.current = {
      ...snap,
      isRunning: false,
      startedAt: null,
      timeLeft: remaining,
      resumeHold: inProgress,
    };
    persistPausedFocusSession({
      selectedTarget: persistRef.current.selectedTarget,
      sessionLength: persistRef.current.sessionLength,
      liveIsRunning: false,
      liveStartedAt: null,
      timeLeft: remaining,
      hasCompletedSession: persistRef.current.hasCompletedSession,
      sessionCount: persistRef.current.sessionCount,
      keepAlive: inProgress,
    });
    setTimeLeft(remaining);
    setIsRunning(false);
    setStartedAt(null);
    if (inProgress) setResumeHold(true);
    publishLiveFocusSnapshot({
      selectedTarget: persistRef.current.selectedTarget,
      sessionLength: persistRef.current.sessionLength,
      timeLeft: remaining,
      hasCompletedSession: persistRef.current.hasCompletedSession,
      sessionCount: persistRef.current.sessionCount,
      isLive: false,
      resumeHold: inProgress,
    });
  };
  const freezeRef = useRef(freezeLiveToContinue);
  freezeRef.current = freezeLiveToContinue;

  // Cold mount / remount: hydrate from storage is already paused in useState,
  // but disarm before paint so an interval cannot start this mount.
  useLayoutEffect(() => {
    runArmedRef.current = false;
    bumpFocusRunEpoch();
    stopTimerNow();
    rewriteStoredFocusSessionPaused();
    if (!restoredSession) return;
    const remaining = remainingSecondsOnRestore(restoredSession);
    setIsRunning(false);
    setStartedAt(null);
    setTimeLeft(remaining);
    const needsContinue =
      remaining > 0 && restoredSessionNeedsContinue(restoredSession);
    if (needsContinue) {
      setResumeHold(true);
      if (isFocusDocumentReload()) {
        reloadStartQuietUntilRef.current =
          Date.now() + FOCUS_DOCUMENT_RELOAD_START_QUIET_MS;
      }
    }
    persistPausedFocusSession({
      selectedTarget: restoredSession.selectedTarget,
      sessionLength: restoredSession.sessionLength,
      liveIsRunning: false,
      liveStartedAt: null,
      timeLeft: remaining,
      hasCompletedSession: restoredSession.hasCompletedSession,
      sessionCount: restoredSession.sessionCount ?? 0,
      keepAlive: needsContinue,
    });
  }, [restoredSession]);

  // Capture-phase page lifecycle lives in focusSessionGuard (eager from main).
  // Register the live freeze so wine/QA hard refresh can disarm without
  // relying on bubble listeners on the lazy Focus chunk.
  useLayoutEffect(() => {
    return registerFocusFreeze({
      freeze: () => freezeRef.current(),
      isLive: () =>
        persistRef.current.isRunning || runArmedRef.current,
    });
  }, []);

  useLayoutEffect(() => {
    return () => {
      publishLiveFocusSnapshot(null);
    };
  }, []);

  const quickTargets = useMemo(() => {
    // ⚡ PERFORMANCE OPTIMIZATION:
    // Optimize chained array operations (.filter().slice(0, N).map()) with a single-pass for loop.
    // This collects elements and exits early to eliminate full-array O(N) iterations and intermediate array allocations.

    const noteItems = [];
    for (let i = 0; i < notes.length; i++) {
      if (noteItems.length === 4) break;
      const note = notes[i];
      noteItems.push({
        id: note.id,
        title: extractNoteSummary(note),
        meta: new Date(note.updated_at).toLocaleDateString(),
      });
    }

    const paperItems = [];
    for (let i = 0; i < papers.length; i++) {
      if (paperItems.length === 4) break;
      const paper = papers[i];
      if (paper.status === "To Read" || paper.status === "Reading") {
        paperItems.push({
          id: paper.id,
          title: paper.title,
          meta: paper.publication_date
            ? (
                parseInt(paper.publication_date.substring(0, 4)) || "No year"
              ).toString()
            : "No year",
        });
      }
    }

    const todayQueue = resolveTodayTasks(tasks);
    const todayIds = new Set(todayQueue.map((task) => task.id));
    const taskItems = [];
    for (let i = 0; i < todayQueue.length; i++) {
      if (taskItems.length === 4) break;
      const task = todayQueue[i];
      taskItems.push({
        id: task.id,
        title: task.title,
        meta: task.due_date
          ? new Date(task.due_date).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Today",
      });
    }
    for (let i = 0; i < tasks.length; i++) {
      if (taskItems.length === 4) break;
      const task = tasks[i];
      if (task.completed || todayIds.has(task.id)) continue;
      taskItems.push({
        id: task.id,
        title: task.title,
        meta: task.due_date
          ? new Date(task.due_date).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "No due date",
      });
    }

    return [
      {
        type: "note" as FocusTargetType,
        title: "Notes",
        description: "Recently edited notes ready for synthesis",
        icon: FileText,
        items: noteItems,
      },
      {
        type: "paper" as FocusTargetType,
        title: "Papers",
        description: "Papers waiting for a close read or annotation",
        icon: BookOpen,
        items: paperItems,
      },
      {
        type: "task" as FocusTargetType,
        title: "Today",
        description: "Your Today list, then other open tasks",
        icon: CheckSquare,
        items: taskItems,
      },
    ];
  }, [notes, papers, tasks, todayOrderedIds]);

  const focusInsights = useMemo(() => {
    const insights: { title: string; detail: string }[] = [];

    // ⚡ PERFORMANCE OPTIMIZATION:
    // Compute multiple aggregate statistics in single O(N) passes.
    // This avoids chaining multiple .filter().length calls that create unnecessary
    // intermediate arrays and trigger redundant iterations during render.
    let unreadPapers = 0;
    for (const p of papers) {
      if (p.status === "To Read") unreadPapers++;
    }

    let inProgressTasks = 0;
    for (const t of tasks) {
      if (!t.completed) inProgressTasks++;
    }

    let notesWithoutTitles = 0;
    for (const n of notes) {
      if (!n.title || n.title.trim() === "") notesWithoutTitles++;
    }

    if (unreadPapers > 0) {
      insights.push({
        title: `${unreadPapers} paper${unreadPapers === 1 ? "" : "s"} waiting to be read`,
        detail:
          "Pick one and spend a pomodoro extracting key claims and open questions.",
      });
    }

    if (inProgressTasks > 0) {
      insights.push({
        title: "Focus on an in-flight task",
        detail:
          "Use a 45-minute deep work block to unblock your highest priority task.",
      });
    }

    if (notesWithoutTitles > 0) {
      insights.push({
        title: "Name your notes",
        detail:
          "Give untitled notes memorable names while the context is fresh.",
      });
    }

    if (insights.length === 0) {
      insights.push({
        title: "Celebrate the calm",
        detail:
          "No urgent items detected—use focus mode for deliberate exploration or literature review.",
      });
    }

    return insights.slice(0, 3);
  }, [notes, papers, tasks]);

  const applyCustomDuration = () => {
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    const clamped = Math.min(minutes, 180);
    setSessionLength(clamped * 60);
    setCustomMinutes("");
  };

  const toggleGroup = (type: FocusTargetType) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const togglePanel = (panel: CollapsiblePanel) => {
    setCollapsedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rq_focus_onboarding_dismissed", "true");
    }
  };

  const handleTargetSelection = (target: SelectedTarget) => {
    sessionAwardedRef.current = false;
    runArmedRef.current = false;
    stopTimerNow();
    setAwardedXp(null);
    setSelectedTarget(target);
    setHasCompletedSession(false);
    setIsRunning(false);
    setStartedAt(null);
    setResumeHold(false);
    setTimeLeft(sessionLength);
  };

  const toggleTimer = () => {
    if (isRunning) {
      runArmedRef.current = false;
      stopTimerNow();
      setIsRunning(false);
      setStartedAt(null);
      setResumeHold(true);
      persistPausedFocusSession({
        selectedTarget,
        sessionLength,
        liveIsRunning: false,
        liveStartedAt: null,
        timeLeft: effectiveTimeLeft,
        hasCompletedSession,
        sessionCount,
        keepAlive: true,
      });
      return;
    }
    if (Date.now() < reloadStartQuietUntilRef.current) {
      return;
    }
    if (hasCompletedSession || timeLeft <= 0) {
      setTimeLeft(sessionLength);
      setHasCompletedSession(false);
    }
    const nextCount = isPaused ? sessionCount : sessionCount + 1;
    if (!isPaused) {
      setSessionCount(nextCount);
    }
    sessionAwardedRef.current = false;
    setAwardedXp(null);
    warmupAudio();
    if (isNotificationEnabled) {
      requestNotificationPermission();
    }
    bumpFocusRunEpoch();
    runArmedRef.current = true;
    const started = Date.now();
    setStartedAt(started);
    setIsRunning(true);
    persistPausedFocusSession({
      selectedTarget,
      sessionLength,
      liveIsRunning: true,
      liveStartedAt: started,
      timeLeft: effectiveTimeLeft,
      hasCompletedSession: false,
      sessionCount: nextCount,
      keepAlive: true,
    });
    dismissOnboarding();
  };

  const handleOpenInWorkspace = () => {
    if (!selectedTarget || !selectedItem) return;

    if (selectedTarget.type === "note") {
      setSelectedNote(selectedItem as Note);
      navigateToView("notes", `/notes/${selectedTarget.id}`);
    } else if (selectedTarget.type === "paper") {
      setSelectedPaper(selectedItem as Paper);
      navigateToView("papers", `/papers/${selectedTarget.id}`);
    } else if (selectedTarget.type === "task") {
      navigateToView("tasks", `/tasks/${selectedTarget.id}`);
    }
  };

  const presets = [
    { label: "warm-up", minutes: 15, value: 15 * 60 },
    { label: "pomodoro", minutes: 25, value: 25 * 60 },
    { label: "deep work", minutes: 45, value: 45 * 60 },
    { label: "dive", minutes: 60, value: 60 * 60 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Bridge guide pinned above the page content (renders once per view,
          owned here instead of an App-level wrapper). */}
      <PageHeader
        className="-mx-4 sm:-mx-6 lg:-mx-8"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <Target className="h-6 w-6 text-primary-500" aria-hidden="true" />
            Focus Studio
          </span>
        }
        description="Design an intentional deep work session. Choose one target from Today, set a duration, and stay in flow. When a task session ends, you can mark it done."
      />

      {showOnboarding && (
        <Card className="border-primary-100 bg-primary-50 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary-500 text-bg-base">
              <Info className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-2">
              <h2 className="font-serif text-body-lg font-semibold text-text-primary">
                How to settle into a Focus Studio sprint
              </h2>
              <ul className="list-disc space-y-2 pl-5 text-body text-text-secondary">
                <li>Pick one item and set a meaningful session length.</li>
                <li>
                  Capture what you learn in the preview or open the full
                  workspace.
                </li>
                <li>Complete the sprint to earn streak-protecting XP.</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-text-tertiary">
              Reopen this guide from the session controls at any time.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={dismissOnboarding}
              className="self-start sm:self-auto"
            >
              Got it
            </Button>
          </div>
        </Card>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="min-w-0">
            <CardHeader className="space-y-0 border-b border-border-subtle p-4 sm:p-6">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border-moderate bg-bg-elevated text-primary-500">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-small font-semibold text-text-secondary">
                      Current session
                    </p>
                    <p className="break-words text-body-lg font-semibold leading-snug text-text-primary">
                      {selectedItem ? (
                        <>
                          {selectedTarget?.type === "note" && "Note review · "}
                          {selectedTarget?.type === "paper" && "Paper focus · "}
                          {selectedTarget?.type === "task" && "Task sprint · "}
                          {selectedTarget?.type === "note" &&
                            extractNoteSummary(selectedItem as Note)}
                          {selectedTarget?.type === "paper" &&
                            (selectedItem as Paper).title}
                          {selectedTarget?.type === "task" &&
                            (selectedItem as Task).title}
                        </>
                      ) : (
                        "Select a focus target"
                      )}
                    </p>
                  </div>
                </div>
                {hasCompletedSession && (
                  <Badge variant="success">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Session complete
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-4 pb-4 pt-6 sm:px-6 sm:pb-6">
              <div className="flex flex-col items-center gap-6">
                <div className="w-full rounded-control border border-border-subtle bg-bg-elevated bg-[repeating-linear-gradient(to_right,var(--border-subtle)_0_1px,transparent_1px_8px),repeating-linear-gradient(to_bottom,var(--border-subtle)_0_1px,transparent_1px_8px)] px-4 py-6 text-center sm:px-8 sm:py-8">
                  <div className="font-mono text-hero font-bold leading-none tabular-nums text-text-primary">
                    {formatTime(effectiveTimeLeft)}
                  </div>

                  <p className="mt-4 font-mono text-caption tabular-nums tracking-[0.14em] text-text-secondary">
                    SESSION {String(sessionOrdinal).padStart(2, "0")} ·{" "}
                    {durationMinutes} MIN ·{" "}
                    {selectedTarget ? selectedTarget.type.toUpperCase() : "FOCUS"}
                  </p>

                  <div className="mt-6 w-full space-y-2">
                    <div className="flex items-center justify-between gap-4 text-caption text-text-secondary">
                      <span>Time remaining</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(progress * 100)}% complete
                      </span>
                    </div>
                    <div
                      className="h-3 w-full overflow-hidden rounded-full border border-border-subtle bg-bg-elevated"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(
                        100,
                        Math.max(0, Math.round(progress * 100)),
                      )}
                      aria-label="Focus session progress"
                    >
                      <div
                        className={`h-full ${
                          hasCompletedSession ? "bg-success" : "bg-primary-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="grid w-full gap-2 sm:grid-cols-2"
                  role="group"
                  aria-label="Session length presets"
                >
                  {presets.map((preset) => (
                    <Button
                      key={preset.value}
                      type="button"
                      variant={
                        sessionLength === preset.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSessionLength(preset.value)}
                      aria-pressed={sessionLength === preset.value}
                      className="h-auto min-h-11 justify-start"
                    >
                      <span className="font-mono tabular-nums">
                        {preset.minutes} min
                      </span>
                      <span>{preset.label}</span>
                    </Button>
                  ))}
                </div>

                <form
                  className="flex w-full flex-col gap-3 rounded-control border border-border-moderate bg-bg-elevated p-4 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyCustomDuration();
                  }}
                  aria-labelledby="custom-duration-label"
                >
                  <div className="min-w-0 flex-1">
                    <label
                      id="custom-duration-label"
                      htmlFor="custom-duration-input"
                      className="text-caption font-medium text-text-secondary"
                    >
                      Custom duration
                    </label>
                    <Input
                      id="custom-duration-input"
                      value={customMinutes}
                      onChange={(event) =>
                        setCustomMinutes(
                          event.target.value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="e.g. 35"
                      inputMode="numeric"
                      aria-describedby="custom-duration-hint"
                      className="mt-1 font-mono tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-small text-text-tertiary sm:justify-end">
                    <span id="custom-duration-hint">minutes</span>
                    <Button type="submit" size="sm" disabled={!customMinutes}>
                      Apply
                    </Button>
                  </div>
                </form>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    onClick={toggleTimer}
                    disabled={!selectedItem || sessionLength === 0}
                    title={
                      !selectedItem
                        ? "Select a target from Today or the library to start"
                        : undefined
                    }
                    aria-describedby={
                      !selectedItem ? "focus-start-hint" : undefined
                    }
                  >
                    {isRunning ? (
                      <Pause className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Play className="h-5 w-5" aria-hidden="true" />
                    )}
                    {isRunning ? "Pause" : isPaused ? "Continue" : "Start focus"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      sessionAwardedRef.current = false;
                      runArmedRef.current = false;
                      stopTimerNow();
                      setAwardedXp(null);
                      setTimeLeft(sessionLength);
                      setIsRunning(false);
                      setStartedAt(null);
                      setHasCompletedSession(false);
                      setResumeHold(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
                  </Button>
                </div>
                {!selectedItem && (
                  <p
                    id="focus-start-hint"
                    className="text-center text-small text-text-secondary"
                  >
                    Select a target from Today or the library to enable Start
                    focus.
                  </p>
                )}

                <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2 border-t border-border-subtle pt-4">
                  <Button
                    type="button"
                    variant={isSoundEnabled ? "secondary" : "ghost"}
                    aria-pressed={isSoundEnabled}
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    title={isSoundEnabled ? "Sound enabled" : "Sound disabled"}
                  >
                    {isSoundEnabled ? (
                      <Volume2 aria-hidden="true" />
                    ) : (
                      <VolumeX aria-hidden="true" />
                    )}
                    {isSoundEnabled ? "Sound on" : "Sound off"}
                  </Button>

                  <Button
                    type="button"
                    variant={isNotificationEnabled ? "secondary" : "ghost"}
                    aria-pressed={isNotificationEnabled}
                    onClick={() =>
                      setIsNotificationEnabled(!isNotificationEnabled)
                    }
                    title={
                      isNotificationEnabled
                        ? "Notifications enabled"
                        : "Notifications disabled"
                    }
                  >
                    {isNotificationEnabled ? (
                      <Bell aria-hidden="true" />
                    ) : (
                      <BellOff aria-hidden="true" />
                    )}
                    {isNotificationEnabled ? "Notifications on" : "Notifications off"}
                  </Button>

                  <span className="h-4 w-px bg-border-subtle" aria-hidden="true" />

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowOnboarding(true)}
                  >
                    <Info aria-hidden="true" /> Tips
                  </Button>
                </div>
              </div>

              {hasCompletedSession && (
                <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t-2 border-success pt-3">
                  <span className="text-caption font-semibold uppercase tracking-[0.14em] text-success">
                    Colophon
                  </span>
                  <span className="font-mono text-caption font-semibold tabular-nums text-success">
                    {durationMinutes} MIN · +{awardedXp ?? xpEarned} XP
                  </span>
                  {selectedTarget?.type === "task" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void completeTask(selectedTarget.id);
                      }}
                    >
                      Mark task done?
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="space-y-0 p-4 sm:p-6">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-small font-semibold text-text-secondary">
                    Focus target
                  </p>
                  <h2 className="mt-2 break-words font-serif text-subtitle font-semibold leading-tight text-text-primary">
                    {selectedItem
                      ? selectedTarget?.type === "note"
                        ? extractNoteSummary(selectedItem as Note)
                        : selectedTarget?.type === "paper"
                          ? (selectedItem as Paper).title
                          : (selectedItem as Task).title
                      : "Nothing selected yet"}
                  </h2>
                </div>
                {selectedTarget && (
                  <Badge variant="neutral">
                    {selectedTarget.type === "note" && "Note"}
                    {selectedTarget.type === "paper" && "Paper"}
                    {selectedTarget.type === "task" && "Task"}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
              {selectedItem ? (
                <>
                  <div className="max-h-56 overflow-y-auto break-words whitespace-pre-line rounded-control border border-border-moderate bg-bg-elevated p-4 text-body text-text-secondary">
                    {selectedTarget?.type === "note" &&
                      extractNotePreview(selectedItem as Note)}
                    {selectedTarget?.type === "paper" &&
                      extractPaperPreview(selectedItem as Paper)}
                    {selectedTarget?.type === "task" &&
                      extractTaskPreview(selectedItem as Task)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-caption text-text-tertiary">
                      {selectedTarget?.type === "paper" &&
                        (selectedItem as Paper).status}
                      {selectedTarget?.type === "task" &&
                        (() => {
                          const dueDate = (selectedItem as Task).due_date;
                          if (!dueDate) {
                            return "No due date";
                          }
                          return `Due ${new Date(dueDate).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}`;
                        })()}
                    </div>
                    <Button
                      type="button"
                      onClick={handleOpenInWorkspace}
                    >
                      Open in workspace
                    </Button>
                  </div>
                </>
              ) : (
                <div
                  className="rounded-control border border-dashed border-border-strong bg-bg-elevated p-4 text-body text-text-secondary"
                  role="status"
                  aria-live="polite"
                >
                  Select a target from Today or the library to preview its
                  details. Start focus stays disabled until a target is
                  selected.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <FocusTargetAside
          isLoading={isLoading}
          quickTargets={quickTargets}
          selectedTarget={selectedTarget}
          handleTargetSelection={handleTargetSelection}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          collapsedPanels={collapsedPanels}
          togglePanel={togglePanel}
          focusInsights={focusInsights}
        />
      </div>
    </div>
  );
}
