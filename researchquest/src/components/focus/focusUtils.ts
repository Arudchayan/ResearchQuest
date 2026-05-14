import type { Note, Paper, Task } from "../../types/database";
import { deriveTitleFromMarkdown } from "../../utils/text";

export type FocusTargetType = "note" | "paper" | "task";

export interface SelectedTarget {
  type: FocusTargetType;
  id: string;
}

export type CollapsedGroups = Record<FocusTargetType, boolean>;

export type CollapsiblePanel = "suggestions";

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
