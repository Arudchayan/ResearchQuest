import type { Note, Paper, Task } from "../../types/database";
import { deriveTitleFromMarkdown } from "../../utils/text";

export type FocusTargetType = "note" | "paper" | "task";

export interface SelectedTarget {
  type: FocusTargetType;
  id: string;
}

export type CollapsedGroups = Record<FocusTargetType, boolean>;

export type CollapsiblePanel = "suggestions";

export const FOCUS_SESSION_STORAGE_KEY = "rq_focus_session";

export interface FocusSessionSnapshot {
  version: 1;
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  isRunning: boolean;
  startedAt: number | null;
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
  const target = snapshot["selectedTarget"];
  if (target === null) return true;
  if (typeof target !== "object") return false;
  const selected = target as Record<string, unknown>;
  return (
    (selected["type"] === "note" ||
      selected["type"] === "paper" ||
      selected["type"] === "task") &&
    typeof selected["id"] === "string"
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

export function saveFocusSession(snapshot: FocusSessionSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FOCUS_SESSION_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
}

export function clearStoredFocusSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FOCUS_SESSION_STORAGE_KEY);
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
