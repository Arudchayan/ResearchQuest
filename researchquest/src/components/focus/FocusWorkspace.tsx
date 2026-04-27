import { useEffect, useMemo, useState } from "react";
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
  ChevronDown,
  ChevronRight,
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
import { ListSkeleton, Skeleton } from "../ui/Skeleton";
import { awardXP, XP_REWARDS } from "../../utils/gamification";
import { deriveTitleFromMarkdown } from "../../utils/text";
import {
  playTimerCompleteSound,
  showTimerCompleteNotification,
  requestNotificationPermission,
  warmupAudio,
} from "../../utils/alerts";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

// KNOWN LIMITATION (RQ-M2-06): Timer state is local to this component. Navigating away resets the timer. Fix deferred to post-M2.

interface FocusWorkspaceProps {
  userId: string | undefined;
}

type FocusTargetType = "note" | "paper" | "task";

interface SelectedTarget {
  type: FocusTargetType;
  id: string;
}

type CollapsedGroups = Record<FocusTargetType, boolean>;

type CollapsiblePanel = "suggestions";

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function extractNoteSummary(note: Note) {
  const raw =
    note.title || deriveTitleFromMarkdown(note.markdown_body);
  return raw.replace(/[#*_`>-]/g, "").trim() || "Untitled note";
}

function extractNotePreview(note: Note) {
  const plain = note.markdown_body
    .replace(/[#*_`>-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
  return (
    plain.trim().slice(0, 220) ||
    "No content yet. Use this focus block to capture your first thoughts."
  );
}

function extractPaperPreview(paper: Paper) {
  if (paper.abstract) {
    return paper.abstract;
  }
  return "No abstract saved yet. Add highlights once you complete this focus sprint.";
}

function extractTaskPreview(task: Task) {
  if (task.description) {
    return task.description;
  }
  return "Break this task into the next concrete step during your focus session.";
}

export function FocusWorkspace({ userId }: FocusWorkspaceProps) {
  const { notes, loading: notesLoading } = useNotes(userId);
  const { papers, loading: papersLoading } = usePapers(userId);
  const { tasks, loading: tasksLoading } = useTasks(userId);

  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setSelectedNote = useAppStore((state) => state.setSelectedNote);
  const setSelectedPaper = useAppStore((state) => state.setSelectedPaper);

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(
    null,
  );
  const [sessionLength, setSessionLength] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(sessionLength);
  const [isRunning, setIsRunning] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [hasCompletedSession, setHasCompletedSession] = useState(false);
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

  const notesMap = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes]);
  const papersMap = useMemo(() => new Map(papers.map(paper => [paper.id, paper])), [papers]);
  const tasksMap = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);

  const selectedItem = useMemo(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.type === "note") {
      return notesMap.get(selectedTarget.id) || null;
    }
    if (selectedTarget.type === "paper") {
      return papersMap.get(selectedTarget.id) || null;
    }
    if (selectedTarget.type === "task") {
      return tasksMap.get(selectedTarget.id) || null;
    }
    return null;
  }, [notesMap, papersMap, tasksMap, selectedTarget]);

  useEffect(() => {
    setTimeLeft(sessionLength);
    setIsRunning(false);
    setHasCompletedSession(false);
  }, [sessionLength, selectedTarget?.id]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          setHasCompletedSession(true);

          if (isSoundEnabled) {
            playTimerCompleteSound();
          }

          if (isNotificationEnabled) {
            const targetName = selectedItem
              ? selectedTarget?.type === "note"
                ? extractNoteSummary(selectedItem as Note)
                : (selectedItem as any).title
              : "Focus Session";

            showTimerCompleteNotification("Focus session complete!", {
              body: `You completed your session on ${targetName}.`,
            });
          }

          if (userId) {
            const durationMinutes = Math.floor(sessionLength / 60);
            const xpEarned = durationMinutes * XP_REWARDS.FOCUS_SESSION_MINUTE;

            if (xpEarned > 0) {
              awardXP(userId, xpEarned, "complete_focus_session");
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

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    isRunning,
    sessionLength,
    userId,
    isSoundEnabled,
    isNotificationEnabled,
    selectedItem,
    selectedTarget,
  ]);

  const isLoading = notesLoading || papersLoading || tasksLoading;
  const effectiveTimeLeft = Math.max(0, timeLeft);
  const isPaused =
    !isRunning &&
    !hasCompletedSession &&
    effectiveTimeLeft > 0 &&
    effectiveTimeLeft < sessionLength;
  const progress =
    sessionLength > 0 ? (sessionLength - effectiveTimeLeft) / sessionLength : 0;

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

    const unreadPapers = papers.filter(
      (paper) => paper.status === "To Read",
    ).length;
    const inProgressTasks = tasks.filter((task) => !task.completed).length;
    const notesWithoutTitles = notes.filter(
      (note) => !note.title || note.title.trim() === "",
    ).length;

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
    setSelectedTarget(target);
    setHasCompletedSession(false);
    setIsRunning(false);
    setTimeLeft(sessionLength);
  };

  const toggleTimer = () => {
    setIsRunning((prev) => {
      if (!prev) {
        // Starting
        warmupAudio();
        if (isNotificationEnabled) {
          requestNotificationPermission();
        }
      }
      return !prev;
    });
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
    { label: "15 min warm-up", value: 15 * 60 },
    { label: "25 min pomodoro", value: 25 * 60 },
    { label: "45 min deep work", value: 45 * 60 },
    { label: "60 min dive", value: 60 * 60 },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 text-primary-500 text-sm font-semibold uppercase tracking-wide">
          <Target className="w-4 h-4" />
          Focus Studio
        </div>
        <h1 className="text-3xl font-bold text-text-primary">
          Design an intentional deep work session
        </h1>
        <p className="text-text-secondary max-w-3xl">
          Choose one target, set a timer, and stay in flow. Your notes, papers,
          and tasks update automatically when the session ends.
        </p>
      </div>

      {showOnboarding && (
        <div className="bg-primary-500/10 border border-primary-200 dark:border-primary-500/40 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-inner">
              <Info className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-2 text-sm sm:text-base">
              <h2 className="text-lg font-semibold text-text-primary">
                How to settle into a Focus Studio sprint
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-text-secondary">
                <li>
                  Pick one item on the right and set a meaningful session
                  length.
                </li>
                <li>
                  Capture what you learn in the preview panel or jump straight
                  into the full workspace.
                </li>
                <li>
                  Log a takeaway at the end—completing the sprint earns
                  streak-protecting XP.
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption text-text-tertiary">
              You can reopen this guide from the session menu at any time.
            </p>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_1fr]">
        <div className="space-y-6">
          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 text-primary-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-secondary">
                    Current session
                  </p>
                  <p className="text-lg font-semibold text-text-primary">
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
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-bg text-success text-sm font-medium">
                  <Sparkles className="w-4 h-4" /> Session complete!
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-5">
              <div className="text-6xl md:text-7xl font-mono font-bold text-text-primary">
                {formatTime(effectiveTimeLeft)}
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-caption text-text-tertiary">
                  <span>Time remaining</span>
                  <span>{Math.round(progress * 100)}% complete</span>
                </div>
                <div
                  className="w-full h-3 md:h-3.5 bg-bg-base rounded-full overflow-hidden shadow-inner"
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
                    className="h-full bg-gradient-to-r from-primary-500 via-primary-500/90 to-primary-600 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div
                className="grid gap-2 w-full sm:grid-cols-2"
                aria-label="Session length presets"
              >
                {presets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setSessionLength(preset.value)}
                    className={`px-3 py-2 rounded-full text-sm font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                      sessionLength === preset.value
                        ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                        : "border-border-subtle text-text-secondary hover:border-primary-400 hover:text-text-primary"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <form
                className="flex flex-col sm:flex-row sm:items-center gap-2 w-full bg-bg-base border border-border-subtle rounded-xl px-4 py-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyCustomDuration();
                }}
                aria-labelledby="custom-duration-label"
              >
                <div className="flex flex-col flex-1">
                  <label
                    id="custom-duration-label"
                    htmlFor="custom-duration-input"
                    className="text-caption font-medium text-text-secondary"
                  >
                    Custom duration
                  </label>
                  <input
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
                    className="mt-1 w-full bg-transparent text-base text-text-primary outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-text-tertiary">
                  <span id="custom-duration-hint">minutes</span>
                  <button
                    type="submit"
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary-500 text-white font-semibold disabled:opacity-50"
                    disabled={!customMinutes}
                  >
                    Apply
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={toggleTimer}
                  disabled={!selectedItem || sessionLength === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
                  type="button"
                >
                  {isRunning ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  {isRunning ? "Pause" : isPaused ? "Resume" : "Start focus"}
                </button>
                <button
                  onClick={() => {
                    setTimeLeft(sessionLength);
                    setIsRunning(false);
                    setHasCompletedSession(false);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border-subtle text-text-secondary hover:border-primary-400 hover:text-primary-500 transition-colors"
                  type="button"
                >
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-border-subtle/50 w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isSoundEnabled
                      ? "text-text-primary bg-bg-base hover:bg-bg-elevated"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={isSoundEnabled ? "Sound enabled" : "Sound disabled"}
                >
                  {isSoundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                  <span className="sr-only">
                    {isSoundEnabled ? "Mute sound" : "Unmute sound"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setIsNotificationEnabled(!isNotificationEnabled)
                  }
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isNotificationEnabled
                      ? "text-text-primary bg-bg-base hover:bg-bg-elevated"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={
                    isNotificationEnabled
                      ? "Notifications enabled"
                      : "Notifications disabled"
                  }
                >
                  {isNotificationEnabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                  <span className="sr-only">
                    {isNotificationEnabled
                      ? "Disable notifications"
                      : "Enable notifications"}
                  </span>
                </button>

                <div className="w-px h-4 bg-border-subtle mx-1" />

                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                >
                  <Info className="w-4 h-4" />
                  <span>Tips</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-secondary">
                  Focus target
                </p>
                <h2 className="text-2xl font-semibold text-text-primary">
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
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-primary-500/10 text-primary-600">
                  {selectedTarget.type === "note" && "Note"}
                  {selectedTarget.type === "paper" && "Paper"}
                  {selectedTarget.type === "task" && "Task"}
                </span>
              )}
            </div>

            {selectedItem ? (
              <div className="mt-4 space-y-4">
                <div className="bg-bg-elevated border border-border-subtle rounded-lg p-4 text-sm text-text-secondary whitespace-pre-line max-h-56 overflow-y-auto">
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
                  <button
                    onClick={handleOpenInWorkspace}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
                    type="button"
                  >
                    Open in workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-text-secondary text-sm">
                Select a target from the lists on the right to preview its
                details and plan your focus session.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[
                { key: "note" as const, label: "Notes" },
                { key: "paper" as const, label: "Papers" },
                { key: "task" as const, label: "Tasks" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm p-5 space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <span>{label}</span>
                  </div>
                  <ListSkeleton
                    count={3}
                    itemType={
                      key === "task"
                        ? "task"
                        : key === "paper"
                          ? "paper"
                          : "note"
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            quickTargets.map((group) => {
              const Icon = group.icon;
              const items = group.items;
              const isCollapsed = collapsedGroups[group.type];
              return (
                <div
                  key={group.type}
                  className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.type)}
                    className="w-full flex items-start justify-between gap-3 p-5 text-left"
                    aria-expanded={!isCollapsed}
                    aria-controls={`focus-group-${group.type}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                        <Icon className="w-4 h-4 text-primary-500" />
                        {group.title}
                      </div>
                      <p className="text-caption text-text-tertiary mt-1">
                        {group.description}
                      </p>
                    </div>
                    {isCollapsed ? (
                      <ChevronRight
                        className="w-4 h-4 text-text-tertiary"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="w-4 h-4 text-text-tertiary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div
                      id={`focus-group-${group.type}`}
                      className="border-t border-border-subtle"
                    >
                      {items.length > 0 ? (
                        <ul className="divide-y divide-border-subtle/60">
                          {items.map((item) => {
                            const isActive =
                              selectedTarget?.type === group.type &&
                              selectedTarget.id === item.id;
                            return (
                              <li key={item.id}>
                                <button
                                  onClick={() =>
                                    handleTargetSelection({
                                      type: group.type,
                                      id: item.id,
                                    })
                                  }
                                  className={`w-full text-left px-5 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${
                                    isActive
                                      ? "bg-primary-500/10 text-primary-600"
                                      : "hover:bg-bg-base"
                                  }`}
                                  type="button"
                                  aria-pressed={isActive}
                                  title={`Focus on ${item.title}`}
                                >
                                  <p className="text-sm font-semibold text-text-primary line-clamp-2">
                                    {item.title}
                                  </p>
                                  <p className="text-caption text-text-tertiary mt-1">
                                    {item.meta}
                                  </p>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="px-5 py-6 text-sm text-text-tertiary" role="status" aria-live="polite">
                          {group.type === "note" &&
                            "No notes yet. Create one to capture your thinking."}
                          {group.type === "paper" &&
                            "No papers are marked for reading. Add one from the Papers tab."}
                          {group.type === "task" &&
                            "No active tasks. Create a task to anchor your next focus sprint."}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle/60 text-caption">
                    <span className="text-text-tertiary">
                      {items.length} suggested {group.title.toLowerCase()}
                    </span>
                    <button
                      className="text-primary-500 hover:text-primary-600"
                      onClick={() => {
                        const targetView =
                          group.type === "task"
                            ? "tasks"
                            : group.type === "paper"
                              ? "papers"
                              : "notes";
                        setCurrentView(targetView);
                        window.history.pushState(
                          null,
                          "",
                          targetView === "notes" ? "/" : `/${targetView}`,
                        );
                      }}
                      type="button"
                      title={`Open all ${group.title.toLowerCase()}`}
                      aria-label={`Open the full ${group.title.toLowerCase()} view`}
                    >
                      View all
                    </button>
                  </div>
                </div>
              );
            })
          )}

          <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-sm">
            <button
              type="button"
              onClick={() => togglePanel("suggestions")}
              className="w-full flex items-center justify-between gap-2 p-5 text-sm font-semibold text-text-secondary hover:text-text-primary"
              aria-expanded={!collapsedPanels.suggestions}
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                Suggested moves
              </span>
              {collapsedPanels.suggestions ? (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            {!collapsedPanels.suggestions && (
              <ul className="p-5 pt-0 space-y-2">
                {focusInsights.map((insight) => (
                  <li
                    key={insight.title}
                    className="p-3 rounded-lg bg-bg-base/60 border border-border-subtle/60"
                  >
                    <p className="text-sm font-semibold text-text-primary">
                      {insight.title}
                    </p>
                    <p className="text-caption text-text-secondary mt-1">
                      {insight.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
