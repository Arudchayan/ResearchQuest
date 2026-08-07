import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  saveFocusSession,
  clearStoredFocusSession,
} from "./focusUtils";
import { FocusTargetAside } from "./FocusTargetAside";

const DEFAULT_SESSION_LENGTH = 25 * 60;

interface FocusWorkspaceProps {
  userId: string | undefined;
}

export function FocusWorkspace({ userId }: FocusWorkspaceProps) {
  const { notes, loading: notesLoading } = useNotes(userId);
  const { papers, loading: papersLoading } = usePapers(userId);
  const { tasks, loading: tasksLoading } = useTasks(userId, { owner: false });

  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setSelectedNote = useAppStore((state) => state.setSelectedNote);
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper);

  const [restoredSession] = useState(loadStoredFocusSession);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    restoredSession?.selectedTarget ?? null,
  );
  const [sessionLength, setSessionLength] = useState(
    restoredSession?.sessionLength ?? DEFAULT_SESSION_LENGTH,
  );
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!restoredSession) return DEFAULT_SESSION_LENGTH;
    if (restoredSession.isRunning && restoredSession.startedAt !== null) {
      return Math.max(
        0,
        restoredSession.sessionLength -
          Math.floor((Date.now() - restoredSession.startedAt) / 1000),
      );
    }
    return restoredSession.timeLeft;
  });
  const [isRunning, setIsRunning] = useState(
    restoredSession?.isRunning ?? false,
  );
  const [startedAt, setStartedAt] = useState<number | null>(
    restoredSession?.startedAt ?? null,
  );
  const [customMinutes, setCustomMinutes] = useState("");
  const [hasCompletedSession, setHasCompletedSession] = useState(
    restoredSession?.hasCompletedSession ?? false,
  );
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
        // skipXpToast: the toast below already announces the XP earned
        awardXP(userId, xpEarned, "complete_focus_session")
          .then((result) =>
            notifyGamificationResult(result, { skipXpToast: true }),
          )
          .catch((err) => logger.error("Failed to award XP", err));
        toast.success("Focus session complete!", {
          description: `You earned ${xpEarned} XP for ${durationMinutes} minutes of focus.`,
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
  ]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          completeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, completeSession]);

  useEffect(() => {
    if (hasCompletedSession || !restoredSession?.isRunning || timeLeft > 0) {
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
    effectiveTimeLeft < sessionLength;
  const progress =
    sessionLength > 0 ? (sessionLength - effectiveTimeLeft) / sessionLength : 0;

  useEffect(() => {
    const hasActiveSession =
      isRunning ||
      hasCompletedSession ||
      (selectedTarget !== null && effectiveTimeLeft < sessionLength);

    if (!hasActiveSession) {
      clearStoredFocusSession();
      return;
    }

    saveFocusSession({
      version: 1,
      selectedTarget,
      sessionLength,
      isRunning,
      startedAt: isRunning ? startedAt : null,
      timeLeft: effectiveTimeLeft,
      hasCompletedSession,
    });
  }, [
    isRunning,
    startedAt,
    hasCompletedSession,
    selectedTarget,
    sessionLength,
    effectiveTimeLeft,
  ]);

  const quickTargets = useMemo(() => {
    return [
      {
        type: "note" as FocusTargetType,
        title: "Notes",
        description: "Recently edited notes ready for synthesis",
        icon: FileText,
        items: notes.slice(0, 4).map((note) => ({
          id: note.id,
          title: extractNoteSummary(note),
          meta: new Date(note.updated_at).toLocaleDateString(),
        })),
      },
      {
        type: "paper" as FocusTargetType,
        title: "Papers",
        description: "Papers waiting for a close read or annotation",
        icon: BookOpen,
        items: papers
          .filter(
            (paper) => paper.status === "To Read" || paper.status === "Reading",
          )
          .slice(0, 4)
          .map((paper) => ({
            id: paper.id,
            title: paper.title,
            meta: paper.publication_date
              ? (
                  parseInt(paper.publication_date.substring(0, 4)) || "No year"
                ).toString()
              : "No year",
          })),
      },
      {
        type: "task" as FocusTargetType,
        title: "Tasks",
        description: "Upcoming commitments that benefit from deep work",
        icon: CheckSquare,
        items: tasks
          .filter((task) => !task.completed)
          .slice(0, 4)
          .map((task) => ({
            id: task.id,
            title: task.title,
            meta: task.due_date
              ? new Date(task.due_date).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "No due date",
          })),
      },
    ];
  }, [notes, papers, tasks]);

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
    setSelectedTarget(target);
    setHasCompletedSession(false);
    setIsRunning(false);
    setStartedAt(null);
    setTimeLeft(sessionLength);
  };

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      setStartedAt(null);
      return;
    }
    if (hasCompletedSession || timeLeft <= 0) {
      setTimeLeft(sessionLength);
      setHasCompletedSession(false);
    }
    sessionAwardedRef.current = false;
    warmupAudio();
    if (isNotificationEnabled) {
      requestNotificationPermission();
    }
    setStartedAt(Date.now());
    setIsRunning(true);
  };

  const handleOpenInWorkspace = () => {
    if (!selectedTarget || !selectedItem) return;

    if (selectedTarget.type === "note") {
      setSelectedNote(selectedItem as Note);
      setCurrentView("notes");
      window.history.pushState(null, "", `/notes/${selectedTarget.id}`);
    } else if (selectedTarget.type === "paper") {
      setSelectedPaper(selectedItem as Paper);
      setCurrentView("papers");
      window.history.pushState(null, "", `/papers/${selectedTarget.id}`);
    } else if (selectedTarget.type === "task") {
      setCurrentView("tasks");
      window.history.pushState(null, "", "/tasks");
    }
  };

  const presets = [
    { label: "warm-up", minutes: 15, value: 15 * 60 },
    { label: "pomodoro", minutes: 25, value: 25 * 60 },
    { label: "deep work", minutes: 45, value: 45 * 60 },
    { label: "dive", minutes: 60, value: 60 * 60 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 md:p-8">
      <PageHeader
        className="-mx-4 sm:-mx-6 md:-mx-8 md:p-8"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <Target className="h-6 w-6 text-primary-500" aria-hidden="true" />
            Focus Studio
          </span>
        }
        description="Design an intentional deep work session. Choose one target, set a duration, and stay in flow. Your notes, papers, and tasks update automatically when the session ends."
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
                <div className="font-mono text-hero font-bold leading-none tabular-nums text-text-primary">
                  {formatTime(effectiveTimeLeft)}
                </div>

                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between gap-4 text-caption text-text-tertiary">
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
                  >
                    {isRunning ? (
                      <Pause className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Play className="h-5 w-5" aria-hidden="true" />
                    )}
                    {isRunning ? "Pause" : isPaused ? "Resume" : "Start focus"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      sessionAwardedRef.current = false;
                      setTimeLeft(sessionLength);
                      setIsRunning(false);
                      setStartedAt(null);
                      setHasCompletedSession(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
                  </Button>
                </div>

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
                  Select a target from the lists to preview its details and
                  plan your focus session.
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
