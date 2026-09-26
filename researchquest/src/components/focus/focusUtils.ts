import type { Note, Paper, Task } from "../../types/database";
import { deriveTitleFromMarkdown } from "../../utils/text";

export type FocusEntityType = "note" | "paper" | "task";
export type FocusTargetType = FocusEntityType | "freeform";

export interface SelectedTarget {
  type: FocusTargetType;
  id: string;
  title?: string;
}

export type CollapsedGroups = Record<FocusEntityType, boolean>;

export type CollapsiblePanel = "suggestions";

export const FOCUS_SESSION_STORAGE_KEY = "rq_focus_session";

export interface FocusSessionSnapshot {
  version: 1;
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  isRunning: boolean;
  startedAt: number | null;
  /** Wall-clock epoch ms the live run ends. Absent on pre-fix snapshots. */
  deadline?: number | null;
  timeLeft: number;
  hasCompletedSession: boolean;
  sessionCount?: number;
}

function isFocusSessionSnapshot(value: unknown): value is FocusSessionSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot["version"] !== 1) return false;
  if (
    typeof snapshot["sessionLength"] !== "number" ||
    snapshot["sessionLength"] <= 0
  ) {
    return false;
  }
  if (typeof snapshot["isRunning"] !== "boolean") return false;
  if (typeof snapshot["hasCompletedSession"] !== "boolean") return false;
  if (typeof snapshot["timeLeft"] !== "number" || snapshot["timeLeft"] < 0) {
    return false;
  }
  const sessionCount = snapshot["sessionCount"];
  if (
    sessionCount !== undefined &&
    (typeof sessionCount !== "number" ||
      !Number.isInteger(sessionCount) ||
      sessionCount < 0)
  ) {
    return false;
  }
  if (
    snapshot["startedAt"] !== null &&
    typeof snapshot["startedAt"] !== "number"
  ) {
    return false;
  }
  const deadline = snapshot["deadline"];
  if (
    deadline !== undefined &&
    deadline !== null &&
    (typeof deadline !== "number" || deadline < 0)
  ) {
    return false;
  }
  const target = snapshot["selectedTarget"];
  if (target === null) return true;
  if (typeof target !== "object") return false;
  const selected = target as Record<string, unknown>;
  return (
    (selected["type"] === "note" ||
      selected["type"] === "paper" ||
      selected["type"] === "task" ||
      selected["type"] === "freeform") &&
    typeof selected["id"] === "string" &&
    (selected["title"] === undefined || typeof selected["title"] === "string")
  );
}

export function loadStoredFocusSession(): FocusSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFocusSessionSnapshot(parsed)) return null;
    return { ...parsed, sessionCount: parsed.sessionCount ?? 1 };
  } catch {
    return null;
  }
}

/**
 * Deadline-derived remaining. Wall time always counts — hidden tabs,
 * navigation, unmount, and reloads cannot stall or freeze the countdown:
 * - snapshot with a `deadline` → `deadline - now`;
 * - snapshot with a `startedAt` anchor (pre-fix) → the deadline is
 *   reconstructed as `startedAt + sessionLength`;
 * - otherwise (explicitly paused, anchor cleared) → frozen `timeLeft`.
 */
export function remainingSecondsOnRestore(
  snapshot: FocusSessionSnapshot,
  now = Date.now(),
): number {
  if (typeof snapshot.deadline === "number") {
    return Math.max(0, Math.ceil((snapshot.deadline - now) / 1000));
  }
  if (typeof snapshot.startedAt === "number") {
    return Math.max(
      0,
      Math.ceil(
        (snapshot.startedAt + snapshot.sessionLength * 1000 - now) / 1000,
      ),
    );
  }
  return Math.max(0, Math.floor(snapshot.timeLeft));
}

/** Remount of an in-progress snapshot must show Continue even at full duration. */
export function restoredSessionNeedsContinue(
  snapshot: FocusSessionSnapshot | null,
): boolean {
  if (!snapshot || snapshot.hasCompletedSession || !snapshot.selectedTarget) {
    return false;
  }
  if (typeof snapshot.deadline === "number") return true;
  return (
    snapshot.isRunning ||
    snapshot.startedAt !== null ||
    snapshot.timeLeft < snapshot.sessionLength ||
    (snapshot.sessionCount ?? 0) > 0
  );
}

export function saveFocusSession(snapshot: FocusSessionSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOCUS_SESSION_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

/**
 * New-document hard refresh reads this before React paints. Disarm to an
 * explicit paused hold: clear `isRunning` AND the wall-clock anchors
 * (`startedAt`, `deadline`) so the restore freezes at the last painted
 * `timeLeft` instead of deriving from a stale anchor.
 * Empty storage stays empty (fresh Start-only).
 */
export function rewriteStoredFocusSessionPaused(): FocusSessionSnapshot | null {
  const snapshot = loadStoredFocusSession();
  if (!snapshot) return null;
  const paused: FocusSessionSnapshot = {
    ...snapshot,
    isRunning: false,
    startedAt: null,
    deadline: null,
  };
  saveFocusSession(paused);
  return paused;
}

/** Wine Ctrl+Shift+R / hard document reload. Not Playwright live-heap reload. */
export const FOCUS_DOCUMENT_RELOAD_START_QUIET_MS = 1000;

export function isFocusDocumentReload(): boolean {
  if (typeof performance === "undefined") return false;
  try {
    const entries = performance.getEntriesByType("navigation");
    const nav = entries[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

export function clearStoredFocusSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
}

/** Persist in-progress Focus state. A live `deadline` is written through so a
 * remount can resume the countdown instead of freezing at `timeLeft`. */
export function persistPausedFocusSession(input: {
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  liveIsRunning: boolean;
  liveStartedAt: number | null;
  deadline?: number | null;
  timeLeft: number;
  hasCompletedSession: boolean;
  sessionCount: number;
  keepAlive: boolean;
}): number {
  const remaining = input.timeLeft;
  const hasActiveSession =
    input.liveIsRunning ||
    input.hasCompletedSession ||
    input.keepAlive ||
    (input.selectedTarget !== null && remaining < input.sessionLength);
  if (!hasActiveSession) {
    clearStoredFocusSession();
    return remaining;
  }
  saveFocusSession({
    version: 1,
    selectedTarget: input.selectedTarget,
    sessionLength: input.sessionLength,
    isRunning: input.liveIsRunning,
    startedAt: input.liveIsRunning ? input.liveStartedAt : null,
    deadline:
      input.liveIsRunning && typeof input.deadline === "number"
        ? input.deadline
        : null,
    timeLeft: remaining,
    hasCompletedSession: input.hasCompletedSession,
    sessionCount: input.sessionCount,
  });
  return remaining;
}

/**
 * One-way mapping of a legacy `rq_focus_session` snapshot into the live
 * focus-timer store shape. A live snapshot (deadline, or a `startedAt` anchor
 * whose deadline reconstructs as `startedAt + sessionLength`) resumes running
 * — or completes on mount when already expired. Snapshots without any anchor
 * restore as a paused Continue-hold at the last painted `timeLeft`, so no
 * spurious wall-clock jump or award can occur. Every live import mints a run
 * id so completion awards exactly once per run.
 */
export function legacyImportForStore(
  snapshot: FocusSessionSnapshot | null,
  now = Date.now(),
): {
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  status: "running" | "paused" | "complete";
  deadlineMs: number | null;
  remainingSec: number;
  startedAtMs: number | null;
  runId: string | null;
  sessionCount: number;
  awardedRunId: string | null;
} | null {
  if (!snapshot || !snapshot.selectedTarget) return null;
  if (snapshot.hasCompletedSession) {
    return {
      selectedTarget: snapshot.selectedTarget,
      sessionLength: snapshot.sessionLength,
      status: "complete",
      deadlineMs: null,
      remainingSec: 0,
      startedAtMs: snapshot.startedAt,
      runId: `legacy-${snapshot.startedAt ?? "none"}`,
      sessionCount: snapshot.sessionCount ?? 0,
      awardedRunId: `legacy-${snapshot.startedAt ?? "none"}`,
    };
  }
  const anchorDeadlineMs =
    typeof snapshot.deadline === "number"
      ? snapshot.deadline
      : typeof snapshot.startedAt === "number"
        ? snapshot.startedAt + snapshot.sessionLength * 1000
        : null;
  if (snapshot.isRunning && anchorDeadlineMs !== null) {
    return {
      selectedTarget: snapshot.selectedTarget,
      sessionLength: snapshot.sessionLength,
      status: "running",
      deadlineMs: anchorDeadlineMs,
      remainingSec: remainingSecondsOnRestore(snapshot, now),
      startedAtMs: snapshot.startedAt,
      runId: makeLegacyFocusRunId(now),
      sessionCount: snapshot.sessionCount ?? 0,
      awardedRunId: null,
    };
  }
  return {
    selectedTarget: snapshot.selectedTarget,
    sessionLength: snapshot.sessionLength,
    status: "paused",
    deadlineMs: null,
    remainingSec: remainingSecondsOnRestore(snapshot, now),
    startedAtMs: null,
    runId: makeLegacyFocusRunId(now),
    sessionCount: snapshot.sessionCount ?? 0,
    awardedRunId: null,
  };
}

function makeLegacyFocusRunId(nowMs = Date.now()): string {
  return `legacy-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function extractNoteSummary(note: Note) {
  const raw =
    note.title || deriveTitleFromMarkdown(note.markdown_body);
  return raw.replace(/[#*_`>-]/g, "").trim() || "Untitled note";
}

export function extractNotePreview(note: Note) {
  const plain = note.markdown_body
    .replace(/[#*_`>-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
  return (
    plain.trim().slice(0, 220) ||
    "No content yet. Use this focus block to capture your first thoughts."
  );
}

export function extractPaperPreview(paper: Paper) {
  if (paper.abstract) {
    return paper.abstract;
  }
  return "No abstract saved yet. Add highlights once you complete this focus sprint.";
}

export function extractTaskPreview(task: Task) {
  if (task.description) {
    return task.description;
  }
  return "Break this task into the next concrete step during your focus session.";
}

export function resolveFocusTitle(
  target: SelectedTarget | null,
  item: Note | Paper | Task | null,
): string {
  if (!target) return "Nothing selected yet";
  switch (target.type) {
    case "freeform":
      return target.title?.trim() || "Free focus";
    case "note":
      return item ? extractNoteSummary(item as Note) : "Nothing selected yet";
    case "paper":
      return item ? (item as Paper).title : "Nothing selected yet";
    case "task":
      return item ? (item as Task).title : "Nothing selected yet";
    default: {
      const _exhaustive: never = target.type;
      return _exhaustive;
    }
  }
}
